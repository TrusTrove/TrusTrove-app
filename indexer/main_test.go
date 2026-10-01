package main

import "testing"

func TestMainInit(t *testing.T) {
	// A placeholder test to ensure go test framework detects this package
	// and doesn't fail with "no tests to run".
	t.Log("Root package test suite initialized")
}

// TestExitCodeFor pins the contract an orchestrator depends on: a clean
// SIGINT/SIGTERM stop reports success, every failure path reports non-zero so
// `restart: on-failure` (Docker) / `Restart=on-failure` (systemd) brings the
// indexer back. See issue #932.
func TestExitCodeFor(t *testing.T) {
	cases := []struct {
		name  string
		cause shutdownCause
		want  int
	}{
		{"termination signal", causeTerminationSignal, exitSuccess},
		{"listener failure", causeListenerFailure, exitFailure},
		{"http server failure", causeHTTPServerFailure, exitFailure},
		{"unset cause defaults to failure", shutdownCause(""), exitFailure},
		{"unknown cause", shutdownCause("disk on fire"), exitFailure},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := exitCodeFor(tc.cause); got != tc.want {
				t.Errorf("exitCodeFor(%q): got %d, want %d", tc.cause, got, tc.want)
			}
		})
	}
}
