package io.github.intisy.ai.shared.capability;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CapabilitiesTest {

    private static Map<String, Object> map(Object... pairs) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) out.put((String) pairs[i], pairs[i + 1]);
        return out;
    }

    private static List<Object> list(Object... items) {
        return new ArrayList<>(Arrays.asList(items));
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> section(Map<String, Object> schema, String key) {
        return (List<Map<String, Object>>) schema.get(key);
    }

    @Test
    void readsBackNothingForAPluginThatDeclaredNothing() {
        assertTrue(Capabilities.get("never-declared").isEmpty());
    }

    @Test
    void keepsOnlyTheNonEmptyArrays() {
        Capabilities.define("only-fields", map("fields", list(map("key", "a", "type", "string"))));

        Map<String, Object> schema = Capabilities.get("only-fields");
        assertTrue(schema.containsKey("fields"));
        assertFalse(schema.containsKey("actions"));
        assertFalse(schema.containsKey("sections"));
        assertFalse(schema.containsKey("data"));
    }

    @Test
    void dedupesFieldsByKeyWithTheLatestWinning() {
        Capabilities.define("merge", map("fields", list(map("key", "level", "type", "number", "min", 1L))));
        Capabilities.define("merge", map("fields", list(map("key", "level", "type", "number", "min", 5L))));

        List<Map<String, Object>> fields = section(Capabilities.get("merge"), "fields");
        assertEquals(1, fields.size());
        assertEquals(5L, fields.get(0).get("min"));
    }

    @Test
    void dropsAFieldWithNoKeyOrAnUnknownType() {
        Capabilities.define("bad", map("fields", list(
                map("type", "string"),
                map("key", "x", "type", "wormhole"),
                map("key", "ok", "type", "boolean"))));

        List<Map<String, Object>> fields = section(Capabilities.get("bad"), "fields");
        assertEquals(1, fields.size());
        assertEquals("ok", fields.get(0).get("key"));
    }

    @Test
    void keepsOnlyWellFormedOptions() {
        Capabilities.define("opts", map("fields", list(map("key", "mode", "type", "select",
                "options", list(map("value", "a", "label", "A"), map("value", "b"), "nonsense")))));

        List<Map<String, Object>> fields = section(Capabilities.get("opts"), "fields");
        assertEquals(list(map("value", "a", "label", "A")), fields.get(0).get("options"));
    }

    /** An action and a section share an id, and are told apart by the array that declared them. */
    @Test
    void sanitisesAnActionAndASectionByTheirOwnShapes() {
        Capabilities.define("shapes", map(
                "actions", list(map("id", "run", "label", "Run", "danger", Boolean.TRUE, "order", 3L)),
                "sections", list(map("id", "run", "label", "Run", "order", 3L, "scope", "home"))));

        Map<String, Object> action = section(Capabilities.get("shapes"), "actions").get(0);
        assertEquals(Boolean.TRUE, action.get("danger"));
        assertFalse(action.containsKey("order"), "an action carries no order");

        Map<String, Object> declared = section(Capabilities.get("shapes"), "sections").get(0);
        assertEquals(3L, declared.get("order"));
        assertEquals("home", declared.get("scope"));
        assertFalse(declared.containsKey("danger"), "a section carries no danger flag");
    }

    @Test
    void ignoresAnUnrecognisedSectionScope() {
        Capabilities.define("scope", map("sections", list(map("id", "s", "label", "S", "scope", "elsewhere"))));

        assertFalse(section(Capabilities.get("scope"), "sections").get(0).containsKey("scope"));
    }

    /**
     * A path outside the home names something the declaring plugin does not own. The rule is purely
     * syntactic, so even a "nested/../ok" that would resolve back inside is refused: deciding
     * containment by resolving would mean knowing the home, which a declaration does not.
     */
    @Test
    void acceptsOnlyPathsInsideTheHome() {
        Capabilities.define("data", map("data", map("paths", list(
                "cache/models.json", "/etc/passwd", "\\windows\\system32", "C:/secrets",
                "../../escape", "nested/../ok"))));

        assertEquals(list("cache/models.json"),
                ((Map<String, Object>) Capabilities.get("data").get("data")).get("paths"));
    }

    @Test
    void mergesDataPathsWithoutDuplicating() {
        Capabilities.define("paths", map("data", map("paths", list("a", "b"))));
        Capabilities.define("paths", map("data", map("paths", list("b", "c"))));

        assertEquals(list("a", "b", "c"),
                ((Map<String, Object>) Capabilities.get("paths").get("data")).get("paths"));
    }

    @Test
    void survivesAWhollyMalformedDeclaration() {
        Capabilities.define("junk", map("fields", "not a list", "actions", 7L, "data", "nope"));

        assertTrue(Capabilities.get("junk").isEmpty());
    }
}
