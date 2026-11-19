// Package netguard validates outbound URLs before the indexer sends data to
// them. It is shared by webhook subscription creation (which validates once)
// and webhook delivery (which must re-validate every request and redirect,
// because DNS can change after the subscription was created).
package netguard

import (
	"net"
	"net/url"
)

// IsSafeURL reports whether rawURL is an http(s) URL whose host resolves only
// to public addresses.
//
// Loopback, private, link-local, unspecified and multicast destinations are
// rejected so a subscriber cannot make the indexer reach services on its own
// network or the cloud metadata endpoint.
func IsSafeURL(rawURL string) bool {
	u, err := url.ParseRequestURI(rawURL)
	if err != nil {
		return false
	}

	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}

	host := u.Hostname()
	if host == "" {
		return false
	}

	ips, err := net.LookupIP(host)
	if err != nil {
		ip := net.ParseIP(host)
		if ip == nil {
			return false
		}
		ips = []net.IP{ip}
	}
	if len(ips) == 0 {
		return false
	}

	for _, ip := range ips {
		if !isPublicIP(ip) {
			return false
		}
	}

	return true
}

func isPublicIP(ip net.IP) bool {
	if ip == nil {
		return false
	}
	return !(ip.IsPrivate() ||
		ip.IsLoopback() ||
		ip.IsUnspecified() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() ||
		ip.IsMulticast())
}
