package de.honeybalecta.scriptgenius

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Die Pläne von ScriptGenius: eine Datei <id>.scriptgenius je Plan im Ordner files/plaene der App.
 *  Die Oberfläche (über SGNative) und HoneyCut (über PlaeneProvider) arbeiten auf denselben Dateien. */
object Plaene {
    private val ID = Regex("^[A-Za-z0-9_-]{1,24}$")
    private fun dir(ctx: Context) = File(ctx.filesDir, "plaene").apply { mkdirs() }
    private fun file(ctx: Context, id: String): File { require(ID.matches(id)) { "ungültige Kennung" }; return File(dir(ctx), "$id.scriptgenius") }

    @Synchronized fun list(ctx: Context): String {
        val out = JSONArray()
        dir(ctx).listFiles { f -> f.isFile && f.name.endsWith(".scriptgenius") }?.sortedBy { it.name }?.forEach { f ->
            runCatching { val o = JSONObject(f.readText()); if (o.optString("app") == "scriptgenius") out.put(o) }
        }
        return out.toString()
    }

    /** Plan sichern. Rückgabe: leer, wenn es geklappt hat, sonst der Grund. */
    @Synchronized fun save(ctx: Context, json: String): String = runCatching {
        val o = JSONObject(json)
        require(o.optString("app") == "scriptgenius") { "kein Plan aus ScriptGenius" }
        val f = file(ctx, o.getString("id"))
        val tmp = File(f.parentFile, f.name + ".tmp")
        tmp.writeText(json)
        if (!tmp.renameTo(f)) { f.delete(); check(tmp.renameTo(f)) { "Datei ließ sich nicht schreiben" } }
        ""
    }.getOrElse { it.message ?: "Speichern fehlgeschlagen" }

    /** Plan löschen: er wandert in files/plaene/papierkorb. */
    @Synchronized fun delete(ctx: Context, id: String) {
        val f = file(ctx, id)
        if (f.isFile) { val t = File(dir(ctx), "papierkorb").apply { mkdirs() }; f.renameTo(File(t, f.name)) }
    }
}
