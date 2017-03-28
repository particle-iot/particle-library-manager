#pragma once

/* <%- name %> library by <%- author %>
 */

// This will load the definition for common Particle variable types
#include "Particle.h"

// This is your main class that users will import into their application
class <%-Name_code%>
{
public:
  /**
   * Constructor
   */
  <%-Name_code%>();

  /**
   * Example method
   */
  void begin();

  /**
   * Example method
   */
  void process();

private:
  /**
   * Example private method
   */
  void doit();
};
