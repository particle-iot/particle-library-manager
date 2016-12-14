/* nominative library by Borges <borges@example.com>
 */

#include "nominative.h"

/**
 * Constructor.
 */
Nominative::Nominative()
{
  // be sure not to call anything that requires hardware be initialized here, put those in begin()
}

/**
 * Example method.
 */
void Nominative::begin()
{
    // initialize hardware
    Serial.println("called begin");
}

/**
 * Example method.
 */
void Nominative::process()
{
    // do something useful
    Serial.println("called process");
    doit();
}

/**
* Example private method
*/
void Nominative::doit()
{
    Serial.println("called doit");
}
