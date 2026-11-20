package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"resumetitan/internal/config"
	"resumetitan/internal/httpx"
	"resumetitan/web"
	"syscall"
	"time"
)

func main() {
	// Listen for SIGINT (CTRL+C) and SIGTERM
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, stop); err != nil {
		slog.Error("server exited with error", "err", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, stop func()) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config error: %v", err)
	}

	mux := http.NewServeMux()

	// Add endpoints for web and api
	mux.Handle("/", httpx.StaticHandler(web.Files))
	mux.HandleFunc("GET /api/health", httpx.GetHealth)
	mux.HandleFunc("GET /api/ping", httpx.HandlePing)

	// ---Add middleware---
	// Panic shutdown recovery
	middlewareHandler := httpx.RecoveryMiddleware(mux)
	// Body Size (1 << 20 = 1 MB)
	middlewareHandler = httpx.MaxBodySizeMiddleware(10)(middlewareHandler)
	// Logging
	middlewareHandler = httpx.LoggingMiddleware(middlewareHandler)
	// Request ID
	middlewareHandler = httpx.RequestIdMiddleware(middlewareHandler)

	srv := &http.Server{
		Addr:              net.JoinHostPort(cfg.Host, cfg.Port),
		Handler:           middlewareHandler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       5 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Start server in background go-routine, not blocking signal listening
	errCh := make(chan error, 1)
	go func() {
		slog.Info("server listening", "addr", srv.Addr)
		err := srv.ListenAndServe()
		if errors.Is(err, http.ErrServerClosed) {
			err = nil
		}
		errCh <- err
	}()

	var serveErr error
	select {
	case <-ctx.Done():
		slog.Info("shutting down gracefully")
	case serveErr = <-errCh:
		if serveErr != nil {
			slog.Error("server failed", "err", err)
		}
	}

	// Restore default signal behavior so second CTRL+C forces immediate exit
	stop()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("forced shutdown due to timeout", "err", err)
		_ = srv.Close()
		return fmt.Errorf("graceful shutdown: %w", serveErr)
	}

	slog.Info("server stopped cleanly")
	return serveErr
}
