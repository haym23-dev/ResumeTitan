#pragma once

#include "resume.hpp"

#include <httplib.h>

namespace apiHandler {
  /**
   * getHealth - Check if API is up
   */
  void getHealth(const httplib::Request&, httplib::Response& res);

  /**
   * getUser - TODO, query database for user based on ID
   */
  void getUser(const httplib::Request& req, httplib::Response& res);

  /**
   * saveUpdateResume - Get updates from UI and update the resume in the db
   */
  void saveUpdateResume(const httplib::Request& req, httplib::Response& res);
} // namespace apiHandler