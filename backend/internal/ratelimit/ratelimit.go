// Package ratelimit provides an in-memory fixed-window limiter for abuse-prone
// endpoints such as login and registration. State is per process, which suits
// the single-instance deployment; a multi-instance deployment would need a
// shared store.
package ratelimit

import (
	"sync"
	"time"
)

type window struct {
	count int
	reset time.Time
}

type Limiter struct {
	mu     sync.Mutex
	limit  int
	period time.Duration
	hits   map[string]*window
	now    func() time.Time
}

func New(limit int, period time.Duration) *Limiter {
	l := &Limiter{limit: limit, period: period, hits: map[string]*window{}, now: time.Now}
	return l
}

// Allow reports whether key may proceed. When it may not, it also returns how
// long until the window resets. Allow does not count the attempt; call Hit.
func (l *Limiter) Allow(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	w := l.current(key)
	if w == nil || w.count < l.limit {
		return true, 0
	}
	return false, w.reset.Sub(l.now())
}

// Hit records one attempt for key.
func (l *Limiter) Hit(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	w := l.current(key)
	if w == nil {
		w = &window{reset: l.now().Add(l.period)}
		l.hits[key] = w
	}
	w.count++
	if len(l.hits) > 10000 {
		l.sweep()
	}
}

// Reset forgets key, e.g. after a successful login.
func (l *Limiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.hits, key)
}

func (l *Limiter) current(key string) *window {
	w, ok := l.hits[key]
	if !ok {
		return nil
	}
	if !l.now().Before(w.reset) {
		delete(l.hits, key)
		return nil
	}
	return w
}

// sweep drops expired windows so the map cannot grow without bound.
func (l *Limiter) sweep() {
	now := l.now()
	for key, w := range l.hits {
		if !now.Before(w.reset) {
			delete(l.hits, key)
		}
	}
}
