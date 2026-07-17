package ai

import "time"

type Config struct {
	Endpoint         string
	Model            string
	APIKey           string
	Local            bool
	ReadTimeout      time.Duration
	MaxResponseBytes int64
}
