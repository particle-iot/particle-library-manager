#pragma once

/* nominative library by Borges <borges@example.com>
 */

// This will load the definition for common Particle variable types
#include "Particle.h"

// This is your main class that users will import into their application
class Nominative
{
public:
  /**
   * Constructor
   */
  Nominative();

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
