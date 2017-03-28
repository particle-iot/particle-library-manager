/* <%- name %> library by <%- author %>
 */

#include "<%- name %>.h"

/**
 * Constructor.
 */
<%- Name_code %>::<%- Name_code %>()
{
  // be sure not to call anything that requires hardware be initialized here, put those in begin()
}

/**
 * Example method.
 */
void <%- Name_code %>::begin()
{
    // initialize hardware
    Serial.println("called begin");
}

/**
 * Example method.
 */
void <%- Name_code %>::process()
{
    // do something useful
    Serial.println("called process");
    doit();
}

/**
* Example private method
*/
void <%- Name_code %>::doit()
{
    Serial.println("called doit");
}
