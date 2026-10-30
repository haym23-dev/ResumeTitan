#include "api_handler.hpp"

#include <httplib.h>

#include <cstdio>

int main(void) {
  httplib::Server srv;

  srv.Get("/api/health", getHealth);
  srv.Get("/api/user", getUser);

  srv.set_mount_point("/", "./public");

  std::puts("http://localhost:8080");
  srv.listen("0.0.0.0", 8080);

  return 0;
}
