// Example usage for nominative library by Borges <borges@example.com>.

#include "nominative.h"

// Initialize objects from the lib
Nominative nominative;

void setup() {
    // Call functions on initialized library objects that require hardware
    nominative.begin();
}

void loop() {
    // Use the library's initialized objects and functions
    nominative.process();
}
