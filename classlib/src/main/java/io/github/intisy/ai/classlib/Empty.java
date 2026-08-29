package io.github.intisy.ai.classlib;

/**
 * The entry point of the shared class library, which reaches nothing on purpose.
 *
 * @implNote A shared runtime's contents come from its seed list and its seed jars, never from what an
 *     entry point happens to call, so anything reachable from here would be weight every consumer
 *     carries for this module's sake rather than its own.
 */
public final class Empty {
    private Empty() {
    }

    /**
     * Does nothing.
     *
     * @param args ignored
     */
    public static void main(String[] args) {
    }
}
