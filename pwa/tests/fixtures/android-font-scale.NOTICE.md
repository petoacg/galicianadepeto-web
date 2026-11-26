# Native Compose font-scale oracle

`android-font-scale-1.7.5.json` was generated on 2026-11-06 by running the **original compiled** `FontScaleConverterFactory` and `FontScaleConverterTable` from `androidx.compose.ui:ui-unit-android:1.7.5` (`classes.jar` inside `ui-unit-release.aar`). It does not use the TypeScript port as its oracle. `NativeFontFixture.java` is the reproducible runner. Its classpath also needs `androidx.collection:collection-jvm:1.4.4` and `org.jetbrains.kotlin:kotlin-stdlib:2.0.21`.

Compile the runner with javac and run it with java using those three JARs on the classpath. Redirect its standard output to the JSON fixture. Calls deliberately retain the factory's lookup cache across the listed scales, in exactly the order in the runner. The fixture contains 1150 cases with forward and inverse conversions. JSON decimal output is rounded back to Float32 before exact comparison, matching Java Float.toString round-tripping; signed zero is preserved.

The original source inspected was `ui-unit-android-1.7.5-sources.jar`, SHA-256 `5b45772b6f0b463bf21646c7bc4d2f8c29df0e21cda724bbfa84b47711c46647`, files:

- `androidMain/androidx/compose/ui/unit/fontscaling/FontScaleConverterFactory.android.kt`
- `androidMain/androidx/compose/ui/unit/fontscaling/FontScaleConverterTable.android.kt`
- `androidMain/androidx/compose/ui/unit/fontscaling/MathUtils.android.kt`

Those original files are Copyright 2023 The Android Open Source Project, licensed under Apache License 2.0, https://www.apache.org/licenses/LICENSE-2.0. The attribution and license header are retained in the modified TypeScript adaptation `src/androidTextScale.ts`. The browser signal/token adapter is an addition; font-scale tables and conversion behavior retain the upstream semantics.

These pure tests do not verify browser `env(preferred-text-scale)` support or rasterized type. Runtime measurement, cleanup events and Android/Chrome comparisons require the main agent's real-browser checks.

The added `nativeLineHeight` equation and the conditional CSS mode follow ui-text-android1.7.5 `androidMain/androidx/compose/ui/text/platform/extensions/SpannableExtensions.android.kt:159–184` (Copyright2020 The Android Open Source Project, Apache2.0). Above fontScale1.05 paragraph line height preserves the nominal line/font ratio; at or below1.05 it converts the line quantity directly. This threshold is distinct from the converter factory1.03. Tests cover both sides of that boundary and role outputs; the original JVM factory oracle remains unchanged.
