package httpx

import (
	"log/slog"
	"net/http"
)

func GetHealth(w http.ResponseWriter, r *http.Request) {
	writeJson(w, http.StatusOK, map[string]bool{"ok": true})
}

func HandlePing(w http.ResponseWriter, r *http.Request) {
	reqId := GetRequestId(r.Context())

	slog.Info("handling ping request", "requestId", reqId)
}
