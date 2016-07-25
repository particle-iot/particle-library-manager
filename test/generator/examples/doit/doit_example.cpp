// Example for nominative library by Borges.

#include "nominative.h"

// Initialize objects from the lib; be sure not to call anything
// that requires hardware be initialized here, put those in setup()
NominativeClass mylib;

void setup() {
    // Call functions on initialized library objects that require hardware
    // to be wired up correct and available.
    mylib.doit();
}

void loop() {
    // Use the library's initialized objects and functions
    mylib.doit();
}