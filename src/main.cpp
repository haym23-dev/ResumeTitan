#include <httplib.h>

#include <cstdio>

int main(void) {
  httplib::Server srv;

  srv.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
    res.set_content(R"({"ok": true})", "application/json");
  });

  srv.set_mount_point("/", "./public");

  std::puts("http://localhost:8080");
  srv.listen("0.0.0.0", 8080);

  return 0;
}