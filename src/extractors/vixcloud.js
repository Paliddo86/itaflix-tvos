// Funzione per estrarre JSON dallo script
function extractJson(scriptText, startMarker, endMarker) {
    const startIndex = scriptText.indexOf(startMarker);
    if (startIndex === -1) return "{}";
    const endIndex = scriptText.indexOf(endMarker, startIndex + startMarker.length);
    if (endIndex === -1) return "{}";
    return scriptText.substring(startIndex + startMarker.length, endIndex).trim().replace(/'/g, '"');
}

export async function extractVideoUrl(videoUrl) {
    if (!videoUrl.includes("vixcloud.co")) {
        throw new Error("L'URL deve essere di Vixcloud");
    }

    try {
        const response = await fetch(videoUrl, {
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        });

        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }

        // Leggere il contenuto HTML
        const htmlText = await response.text();

        // Estrarre il contenuto HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");

        // Trovare lo script che contiene "window.video"
        const scriptText = [...doc.scripts]
            .map(script => script.textContent)
            .find(text => text.includes("window.video"));

        if (!scriptText) throw new Error("Script video non trovato");

        // Estrarre i JSON da window.video e window.masterPlaylist
        const videoJson = extractJson(scriptText, "window.video = ", ";");
        const masterPlaylistJson = extractJson(scriptText, "window.masterPlaylist.params: ", "}");

        const windowVideo = JSON.parse(videoJson);
        const masterPlaylist = JSON.parse(masterPlaylistJson);

        // Costruire l'URL finale del video o della playlist
        return `https://vixcloud.co/playlist/${windowVideo.id}?token=${masterPlaylist.token}&expires=${masterPlaylist.expires}`;
    } catch (err) {
        console.error("Errore durante l'estrazione:", err);
        throw new Error("Errore durante l'estrazione del video.");
    }
}
