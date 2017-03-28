// Example usage for <%- name %> library by <%- author %>.

#include "<%- name %>.h"

// Initialize objects from the lib
<%- Name_code %> <%- name_code %>;

void setup() {
    // Call functions on initialized library objects that require hardware
    <%- name_code %>.begin();
}

void loop() {
    // Use the library's initialized objects and functions
    <%- name_code %>.process();
}
