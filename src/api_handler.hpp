#pragma once

#include <httplib.h>

/**
 * getHealth - Check if API is up
 */
void getHealth(const httplib::Request&, httplib::Response& res) {
  res.set_content(R"({"ok": true})", "application/json");
}

/**
 * getUser - TODO, query database for user based on ID
 */
void getUser(const httplib::Request& req, httplib::Response& res) {
  // TODO
  auto q = req.get_param_value("id");
  res.set_content("Query " + q, "text/plain");
}
