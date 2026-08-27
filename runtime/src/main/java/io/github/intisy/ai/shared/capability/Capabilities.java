package io.github.intisy.ai.shared.capability;

import io.github.intisy.ai.seam.JsonUtil;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * The capability registry. A plugin describes its controllable settings and actions as DATA, so a
 * generic dashboard renders a typed control panel for it without hardcoding any plugin's features.
 * This layers presentation (types, labels, groups, enums, bounds, buttons) over the flat defaults
 * registered through defineConfig; it writes nothing and is purely a declaration.
 *
 * @implNote every malformed entry is DROPPED rather than rejected, because a bad declaration must
 * never take an app launch down with it. The cost is that a plugin author sees a missing control
 * rather than an error, which the `config schema` CLI is there to make visible.
 */
public final class Capabilities {
    private static final List<String> FIELD_TYPES = Arrays.asList(
            "boolean", "number", "string", "secret", "select", "multiline", "list");
    private static final List<String> FIELD_TEXT_KEYS = Arrays.asList(
            "label", "description", "group", "placeholder", "itemType");
    private static final List<String> FIELD_NUMBER_KEYS = Arrays.asList("min", "max", "step");
    private static final Pattern WINDOWS_DRIVE = Pattern.compile("^[a-zA-Z]:");
    private static final Pattern PATH_SEPARATOR = Pattern.compile("[\\\\/]");

    // The declaring array decides which shape an entry is, exactly as the caller's schema does. An
    // action and a section both carry an id, so inferring the kind from the payload would misread a
    // section that happens to declare neither a scope nor a member list.
    private static final int FIELD = 0;
    private static final int ACTION = 1;
    private static final int SECTION = 2;

    private static final Map<String, Registered> REGISTRY = new LinkedHashMap<String, Registered>();

    private Capabilities() {
    }

    private static final class Registered {
        final List<Map<String, Object>> fields = new ArrayList<Map<String, Object>>();
        final List<Map<String, Object>> actions = new ArrayList<Map<String, Object>>();
        final List<Map<String, Object>> sections = new ArrayList<Map<String, Object>>();
        List<String> dataPaths;
    }

    /**
     * Registers a plugin's schema, merged across calls: fields dedupe by key, actions and sections by
     * id, and the latest declaration wins.
     *
     * @param name the plugin declaring the schema.
     * @param schema the declaration, or null to register the plugin with nothing.
     */
    public static void define(String name, Map<String, Object> schema) {
        Registered store = REGISTRY.get(name);
        if (store == null) {
            store = new Registered();
            REGISTRY.put(name, store);
        }
        if (schema == null) return;

        mergeById(store.fields, JsonUtil.asList(schema.get("fields")), "key", FIELD);
        mergeById(store.actions, JsonUtil.asList(schema.get("actions")), "id", ACTION);
        mergeById(store.sections, JsonUtil.asList(schema.get("sections")), "id", SECTION);

        List<String> paths = sanitizeDataPaths(JsonUtil.asMap(schema.get("data")));
        if (paths == null) return;
        List<String> merged = store.dataPaths == null ? new ArrayList<String>() : store.dataPaths;
        for (String path : paths) {
            if (!merged.contains(path)) merged.add(path);
        }
        store.dataPaths = merged;
    }

    /**
     * Reads back what a plugin declared, carrying only the non-empty arrays so a plugin that declared
     * nothing yields an empty object.
     *
     * @param name the plugin to read.
     * @return what it declared, empty when it declared nothing or was never registered.
     */
    public static Map<String, Object> get(String name) {
        Map<String, Object> out = new LinkedHashMap<String, Object>();
        Registered store = REGISTRY.get(name);
        if (store == null) return out;

        if (!store.fields.isEmpty()) out.put("fields", store.fields);
        if (!store.actions.isEmpty()) out.put("actions", store.actions);
        if (!store.sections.isEmpty()) out.put("sections", store.sections);
        if (store.dataPaths != null) {
            Map<String, Object> data = new LinkedHashMap<String, Object>();
            data.put("paths", store.dataPaths);
            out.put("data", data);
        }
        return out;
    }

    private static void mergeById(List<Map<String, Object>> store, List<Object> raws, String idKey, int kind) {
        if (raws == null) return;
        for (Object raw : raws) {
            Map<String, Object> entry = sanitize(JsonUtil.asMap(raw), kind);
            if (entry == null) continue;
            int existing = indexOf(store, idKey, JsonUtil.asString(entry.get(idKey)));
            if (existing >= 0) store.set(existing, entry);
            else store.add(entry);
        }
    }

    private static int indexOf(List<Map<String, Object>> store, String idKey, String id) {
        for (int i = 0; i < store.size(); i++) {
            if (id != null && id.equals(JsonUtil.asString(store.get(i).get(idKey)))) return i;
        }
        return -1;
    }

    private static Map<String, Object> sanitize(Map<String, Object> raw, int kind) {
        if (raw == null) return null;
        if (kind == FIELD) return sanitizeField(raw);
        return kind == ACTION ? sanitizeAction(raw) : sanitizeSection(raw);
    }

    private static Map<String, Object> sanitizeField(Map<String, Object> raw) {
        String key = nonEmpty(raw.get("key"));
        String type = JsonUtil.asString(raw.get("type"));
        if (key == null || type == null || !FIELD_TYPES.contains(type)) return null;

        Map<String, Object> field = new LinkedHashMap<String, Object>();
        field.put("key", key);
        field.put("type", type);
        for (String text : FIELD_TEXT_KEYS) {
            String value = JsonUtil.asString(raw.get(text));
            if (value != null) field.put(text, value);
        }
        for (String number : FIELD_NUMBER_KEYS) {
            Object value = raw.get(number);
            if (value instanceof Number) field.put(number, value);
        }
        List<Object> options = JsonUtil.asList(raw.get("options"));
        if (options != null) field.put("options", sanitizeOptions(options));
        return field;
    }

    private static List<Object> sanitizeOptions(List<Object> raws) {
        List<Object> options = new ArrayList<Object>();
        for (Object raw : raws) {
            Map<String, Object> option = JsonUtil.asMap(raw);
            if (option == null) continue;
            String value = JsonUtil.asString(option.get("value"));
            String label = JsonUtil.asString(option.get("label"));
            if (value == null || label == null) continue;
            Map<String, Object> kept = new LinkedHashMap<String, Object>();
            kept.put("value", value);
            kept.put("label", label);
            options.add(kept);
        }
        return options;
    }

    private static Map<String, Object> sanitizeAction(Map<String, Object> raw) {
        String id = nonEmpty(raw.get("id"));
        String label = nonEmpty(raw.get("label"));
        if (id == null || label == null) return null;

        Map<String, Object> action = new LinkedHashMap<String, Object>();
        action.put("id", id);
        action.put("label", label);
        String description = JsonUtil.asString(raw.get("description"));
        if (description != null) action.put("description", description);
        String confirm = JsonUtil.asString(raw.get("confirm"));
        if (confirm != null) action.put("confirm", confirm);
        if (Boolean.TRUE.equals(raw.get("danger"))) action.put("danger", Boolean.TRUE);
        return action;
    }

    private static Map<String, Object> sanitizeSection(Map<String, Object> raw) {
        String id = nonEmpty(raw.get("id"));
        String label = nonEmpty(raw.get("label"));
        if (id == null || label == null) return null;

        Map<String, Object> section = new LinkedHashMap<String, Object>();
        section.put("id", id);
        section.put("label", label);
        String description = JsonUtil.asString(raw.get("description"));
        if (description != null) section.put("description", description);
        Object order = raw.get("order");
        if (order instanceof Number) section.put("order", order);
        String scope = JsonUtil.asString(raw.get("scope"));
        if ("home".equals(scope) || "allHomes".equals(scope)) section.put("scope", scope);
        for (String members : Arrays.asList("fields", "actions")) {
            List<Object> raws = JsonUtil.asList(raw.get(members));
            if (raws == null) continue;
            List<Object> names = new ArrayList<Object>();
            for (Object entry : raws) {
                String name = nonEmpty(entry);
                if (name != null) names.add(name);
            }
            section.put(members, names);
        }
        return section;
    }

    /**
     * Only a path INSIDE the home is accepted: an absolute one, or one climbing out with "..", would
     * name something the declaring plugin does not own.
     */
    private static List<String> sanitizeDataPaths(Map<String, Object> data) {
        List<Object> raws = data == null ? null : JsonUtil.asList(data.get("paths"));
        if (raws == null) return null;

        List<String> paths = new ArrayList<String>();
        for (Object raw : raws) {
            String path = nonEmpty(raw);
            if (path == null) continue;
            if (path.startsWith("/") || path.startsWith("\\")) continue;
            if (WINDOWS_DRIVE.matcher(path).find()) continue;
            if (Arrays.asList(PATH_SEPARATOR.split(path, -1)).contains("..")) continue;
            paths.add(path);
        }
        return paths.isEmpty() ? null : paths;
    }

    private static String nonEmpty(Object value) {
        String text = JsonUtil.asString(value);
        return text == null || text.isEmpty() ? null : text;
    }
}
