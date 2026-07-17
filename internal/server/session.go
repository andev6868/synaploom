package server

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"sync"
	"time"
)

const sessionCookieName = "synaploom_session"

type SessionManager struct {
	mu        sync.Mutex
	bootstrap map[[32]byte]struct{}
	sessions  map[[32]byte]time.Time
}

func NewSessionManager() *SessionManager {
	return &SessionManager{bootstrap: make(map[[32]byte]struct{}), sessions: make(map[[32]byte]time.Time)}
}

func randomToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func tokenHash(token string) [32]byte { return sha256.Sum256([]byte(token)) }

func (m *SessionManager) IssueBootstrapToken() (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	m.mu.Lock()
	m.bootstrap[tokenHash(token)] = struct{}{}
	m.mu.Unlock()
	return token, nil
}

func (m *SessionManager) BootstrapHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost && r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		token := r.URL.Query().Get("token")
		hash := tokenHash(token)
		m.mu.Lock()
		_, ok := m.bootstrap[hash]
		if ok {
			delete(m.bootstrap, hash)
		}
		m.mu.Unlock()
		if !ok || token == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		session, err := randomToken()
		if err != nil {
			http.Error(w, "session unavailable", http.StatusInternalServerError)
			return
		}
		expiry := time.Now().Add(24 * time.Hour)
		m.mu.Lock()
		m.sessions[tokenHash(session)] = expiry
		m.mu.Unlock()
		http.SetCookie(w, &http.Cookie{Name: sessionCookieName, Value: session, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, Expires: expiry})
		if r.Method == http.MethodGet {
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}

func (m *SessionManager) RequireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		hash := tokenHash(cookie.Value)
		now := time.Now()
		m.mu.Lock()
		expiry, ok := m.sessions[hash]
		if ok && now.After(expiry) {
			delete(m.sessions, hash)
			ok = false
		}
		m.mu.Unlock()
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
