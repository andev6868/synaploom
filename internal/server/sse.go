package server

// SSE framing is implemented by executionHandlers.events so terminal events can
// close the response in the same control flow that writes them.
