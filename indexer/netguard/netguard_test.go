package netguard

import "testing"

func TestIsSafeURLRejectsInternalDestinations(t *testing.T) {
	cases := []string{
		"http://127.0.0.1/hook",
		"http://127.1.2.3:8080/hook",
		"http://[::1]/hook",
		"http://10.0.0.1/hook",
		"http://172.16.0.1/hook",
		"http://192.168.1.1/hook",
		"http://169.254.169.254/latest/meta-data",
		"http://0.0.0.0/hook",
		"ftp://example.com/hook",
		"://not-a-url",
	}
	for _, raw := range cases {
		t.Run(raw, func(t *testing.T) {
			if IsSafeURL(raw) {
				t.Errorf("IsSafeURL(%q) = true, want false", raw)
			}
		})
	}
}
