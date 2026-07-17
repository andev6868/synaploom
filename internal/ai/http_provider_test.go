package ai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestHTTPProviderCancelsUpstream(t *testing.T) {
	var canceled atomic.Bool
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/x-ndjson")
		f := w.(http.Flusher)
		_, _ = w.Write([]byte("{\"type\":\"ai.delta\",\"content\":\"hello\"}\n"))
		f.Flush()
		<-r.Context().Done()
		canceled.Store(true)
	}))
	defer s.Close()
	ctx, cancel := context.WithCancel(context.Background())
	ch, err := NewHTTPProvider(Config{Endpoint: s.URL}).Stream(ctx, Request{Question: "q"})
	if err != nil {
		t.Fatal(err)
	}
	<-ch
	cancel()
	deadline := time.Now().Add(time.Second)
	for !canceled.Load() && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if !canceled.Load() {
		t.Fatal("not canceled")
	}
}
func TestDisclosureListsExactContext(t *testing.T) {
	d := Disclose(Request{ContextItems: []ContextItem{{Kind: "lesson", Name: "intro"}}}, false)
	if d.Local || len(d.Items) != 1 || d.Items[0].Name != "intro" {
		t.Fatalf("%#v", d)
	}
}
