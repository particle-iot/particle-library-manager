// Example for <%=name%> library by <%=author%>.

#include "<%=name%>.h"

// Initialize objects from the lib; be sure not to call anything
// that requires hardware be initialized here, put those in setup()
<%=Name%>Class mylib;

void setup() {
    // Call functions on initialized library objects that require hardware
    // to be wired up correct and available.
    mylib.doit();
}

void loop() {
    // Use the library's initialized objects and functions
    mylib.doit();
}
