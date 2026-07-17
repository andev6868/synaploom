package server

import (
	"encoding/json"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"

	"github.com/synaploom/synaploom/internal/webassets"
)

type spaHandler struct{ assets fs.FS }

func newSPAHandler() http.Handler { return spaHandler{assets: webassets.FS()} }

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]any{"code": "ROUTE_NOT_FOUND", "message": "API route not found."})
		return
	}
	requested := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
	if requested == "." || requested == "" {
		requested = "index.html"
	}
	if info, err := fs.Stat(h.assets, requested); err == nil && !info.IsDir() {
		h.serveFile(w, r, requested)
		return
	}
	h.serveFile(w, r, "index.html")
}

func (h spaHandler) serveFile(w http.ResponseWriter, r *http.Request, name string) {
	data, err := fs.ReadFile(h.assets, name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if contentType := mime.TypeByExtension(path.Ext(name)); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	if name == "index.html" {
		w.Header().Set("Cache-Control", "no-cache")
	} else if strings.HasPrefix(name, "assets/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}
