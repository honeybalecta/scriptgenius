package de.honeybalecta.scriptgenius

import android.content.ContentProvider
import android.content.ContentValues
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Bundle

/** Schnittstelle für HoneyCut: Pläne über ContentResolver.call lesen, sichern und löschen.
 *  Nur Apps mit derselben Signatur bekommen die Berechtigung PLAENE; call() prüft sie selbst
 *  (die Berechtigung im Manifest gilt für call() nicht von allein). */
class PlaeneProvider : ContentProvider() {
    companion object { const val PERM = "de.honeybalecta.scriptgenius.permission.PLAENE" }

    override fun onCreate() = true

    override fun call(method: String, arg: String?, extras: Bundle?): Bundle {
        val ctx = context ?: throw IllegalStateException("kein Kontext")
        if (ctx.checkCallingPermission(PERM) != PackageManager.PERMISSION_GRANTED) throw SecurityException("Keine Berechtigung für die Pläne aus ScriptGenius")
        val out = Bundle()
        when (method) {
            "version" -> out.putString("version", runCatching { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName }.getOrNull() ?: "")
            "list" -> out.putString("json", Plaene.list(ctx))
            "save" -> out.putString("error", Plaene.save(ctx, arg ?: ""))
            "delete" -> { Plaene.delete(ctx, arg ?: ""); out.putString("error", "") }
            else -> throw IllegalArgumentException("unbekannt: $method")
        }
        return out
    }

    // Tabellen-Zugriff gibt es nicht – alles läuft über call()
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?) = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?) = 0
}
