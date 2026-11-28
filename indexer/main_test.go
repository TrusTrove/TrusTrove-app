package main

import (
	"context"
	"errors"
	"net"
	"net/http"
	"sync"
	"testing"
	"time"
)

func TestRunMainConfigFailure(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "")
	t.Setenv("SERVER_SEED", "")

	if code := runMain(); code != exitFailure {
		t.Errorf("runMain with incomplete configuration returned %d, want %d", code, exitFailure)
	}
}

// inMemoryListener blocks in Accept until the HTTP server closes it.
type inMemoryListener struct {
	accepting chan struct{}
	closed    chan struct{}
	closeOnce sync.Once
}

func (l *inMemoryListener) Accept() (net.Conn, error) {
	close(l.accepting)
	<-l.closed
	return nil, net.ErrClosed
}

func (l *inMemoryListener) Close() error {
	l.closeOnce.Do(func() { close(l.closed) })
	return nil
}

func (l *inMemoryListener) Addr() net.Addr { return &net.TCPAddr{} }

func TestIndexerServicesCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	socket := &inMemoryListener{
		accepting: make(chan struct{}),
		closed:    make(chan struct{}),
	}
	t.Cleanup(func() { _ = socket.Close() })
	listenerStarted, listenerStopped := make(chan struct{}), make(chan struct{})
	workerStarted, workerStopped := make(chan struct{}), make(chan struct{})
	routerStopped := make(chan struct{})
	serveResult := make(chan error, 1)
	services := indexerServices{
		server: &http.Server{},
		serveHTTP: func(server *http.Server) error {
			err := server.Serve(socket)
			serveResult <- err
			return err
		},
		startListener: func(ctx context.Context) error {
			close(listenerStarted)
			<-ctx.Done()
			close(listenerStopped)
			return ctx.Err()
		},
		startWorker: func(ctx context.Context) error {
			close(workerStarted)
			<-ctx.Done()
			close(workerStopped)
			return ctx.Err()
		},
		stopRouter: func() { close(routerStopped) },
	}
	done := make(chan error, 1)
	go func() { done <- services.run(ctx) }()

	// Wait for all three components to start before triggering shutdown.
	timeout := time.After(3 * time.Second)
	for _, component := range []struct {
		name    string
		started <-chan struct{}
	}{
		{"event listener", listenerStarted},
		{"webhook worker", workerStarted},
		{"HTTP server", socket.accepting},
	} {
		select {
		case <-component.started:
		case err := <-done:
			t.Fatalf("run exited before %s started: %v", component.name, err)
		case <-timeout:
			t.Fatalf("%s did not start", component.name)
		}
	}
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("run after cancellation: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("run did not return after cancellation")
	}
	for _, component := range []struct {
		name    string
		stopped <-chan struct{}
	}{
		{"event listener", listenerStopped},
		{"webhook worker", workerStopped},
		{"router", routerStopped},
		{"HTTP listener", socket.closed},
	} {
		select {
		case <-component.stopped:
		default:
			t.Errorf("%s was still running when run returned", component.name)
		}
	}
	select {
	case err := <-serveResult:
		if !errors.Is(err, http.ErrServerClosed) {
			t.Errorf("Serve returned %v, want %v", err, http.ErrServerClosed)
		}
	default:
		t.Error("Serve was still running when run returned")
	}
}

func TestIndexerServicesStartupError(t *testing.T) {
	startErr := errors.New("injected startup error")
	for _, component := range []string{"event listener", "HTTP server"} {
		t.Run(component, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
			defer cancel()
			workerStopped := make(chan struct{})
			socket := &inMemoryListener{
				accepting: make(chan struct{}),
				closed:    make(chan struct{}),
			}
			t.Cleanup(func() { _ = socket.Close() })
			services := indexerServices{
				server: &http.Server{},
				serveHTTP: func(server *http.Server) error {
					return server.Serve(socket)
				},
				startListener: func(ctx context.Context) error {
					<-ctx.Done()
					return ctx.Err()
				},
				startWorker: func(ctx context.Context) error {
					<-ctx.Done()
					close(workerStopped)
					return ctx.Err()
				},
				stopRouter: func() {},
			}
			if component == "event listener" {
				services.startListener = func(context.Context) error { return startErr }
			} else {
				services.serveHTTP = func(*http.Server) error { return startErr }
			}

			if err := services.run(ctx); !errors.Is(err, startErr) {
				t.Fatalf("run returned %v, want %v", err, startErr)
			}
			select {
			case <-workerStopped:
			default:
				t.Error("webhook worker was still running when run returned")
			}
		})
	}
}
