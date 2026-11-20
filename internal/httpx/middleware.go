package httpx

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"runtime/debug"
)

type ctxKey string

const requestIdKey ctxKey = "requestId"

const RequestIdHeader string = "X-Request-ID"

// Extract request ID key from context
func GetRequestId(ctx context.Context) string {
	if id, ok := ctx.Value(requestIdKey).(string); ok {
		return id
	}
	return ""
}

func RequestIdMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := r.Header.Get(RequestIdHeader)
		if reqID == "" {
			reqID = generateId()
		}

		w.Header().Set(RequestIdHeader, reqID)

		ctx := context.WithValue(r.Context(), requestIdKey, reqID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func generateId() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b)
}

func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				slog.Error("panic recovered",
					"error", err,
					"method", r.Method,
					"path", r.URL.Path,
					"stack", string(debug.Stack()),
				)

				http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			}
		}()

		next.ServeHTTP(w, r)
	})
}

func MaxBodySizeMiddleware(maxBytes int64) func(http.Handler) http.Handler {
	// 1 MB max
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.ContentLength > maxBytes {
				http.Error(w, "request body too large", http.StatusRequestEntityTooLarge)
			}

			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			next.ServeHTTP(w, r)
		})
	}
}
