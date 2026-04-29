export interface Archetype {
  id: string;
  animal: string;
  name: string;
  color: string;
  traits: string[];
  triggerWords: string[];
  strategy: string;
  comStyle: string;
}

export interface Objection {
  id: string;
  label: string;
  icon: string;
  example: string;
}

export interface Script {
  script: string;
  tips: string;
  tone: "formal" | "santai";
}

export const archetypes: Archetype[] = [
  {
    id: "owl",
    animal: "🦉",
    name: "Burung Hantu",
    color: "#a78bfa",
    traits: ["Pendiam", "Analitis", "Suka data", "Butuh waktu"],
    triggerWords: ["data", "simulasi", "detail", "pikir dulu", "angka", "perbandingan", "saya pelajari"],
    strategy: "Kirim PDF, grafik, dan simulasi angka. Jangan rush — beri waktu berpikir.",
    comStyle: "To the point, berbasis fakta, minim basa-basi",
  },
  {
    id: "lion",
    animal: "🐯",
    name: "Singa",
    color: "#f59e0b",
    traits: ["Dominan", "Cepat memutuskan", "Berorientasi hasil", "Kompetitif"],
    triggerWords: ["berapa", "langsung", "terbaik", "sekarang", "deal", "saya mau", "kapan bisa"],
    strategy: "Kasih pilihan, jangan argue. Tegas, direct, dan cepat.",
    comStyle: "Singkat, tegas, fokus pada hasil dan keunggulan",
  },
  {
    id: "dolphin",
    animal: "🐬",
    name: "Lumba-Lumba",
    color: "#00ccff",
    traits: ["Ramah", "Sosial", "Butuh relasi personal", "Suka ngobrol"],
    triggerWords: ["gimana kabar", "cerita dulu", "ngobrol", "saya mau tanya", "teman", "kenal"],
    strategy: "Bangun relasi dulu. Gunakan humor ringan, storytelling, dan empati.",
    comStyle: "Hangat, personal, suka obrolan panjang",
  },
  {
    id: "rabbit",
    animal: "🐰",
    name: "Kelinci",
    color: "#ff6b35",
    traits: ["Ragu-ragu", "Takut risiko", "Banyak tanya", "Butuh kepastian"],
    triggerWords: ["takut", "bingung", "nanti dulu", "aman ga", "bagaimana kalau", "risiko", "apa itu"],
    strategy: "Jelaskan step-by-step. Beri reassurance, jaminan, dan kurangi rasa risiko.",
    comStyle: "Penuh tanda tanya, butuh konfirmasi berkali-kali",
  },
];

export const objections: Objection[] = [
  { id: "not_confident", label: "Belum Yakin", icon: "🤔", example: '"Saya pikir-pikir dulu deh ya"' },
  { id: "timing", label: "Nanti Dulu", icon: "⏳", example: '"Nanti aja, lagi belum waktunya"' },
  { id: "already_own", label: "Sudah Punya", icon: "✋", example: '"Saya sudah pakai yang lain"' },
  { id: "busy", label: "Lagi Sibuk", icon: "⚡", example: '"Maaf, lagi sibuk sekarang"' },
  { id: "price", label: "Harga Mahal", icon: "💸", example: '"Kamu lebih mahal dari kompetitor"' },
  { id: "ghosting", label: "Di-ghosting", icon: "👻", example: "Customer tidak balas WA/DM sama sekali" },
];

export const scriptMatrix: Record<string, Record<string, Script[]>> = {
  owl: {
    not_confident: [
      { script: "Baik Bu/Pak, boleh saya bantu kirimkan simulasi angkanya? Bisa dipertimbangkan secara detail dan saya sertakan juga perbandingan dengan opsi lain.", tips: "Burung Hantu butuh data, bukan persuasi emosi.", tone: "formal" },
      { script: "Oke, gak masalah. Mau saya kirimkan dulu PDF-nya? Bisa dibaca-baca santai, nanti kita diskusi kalau sudah siap.", tips: "Beri waktu dan materi — jangan push.", tone: "santai" },
    ],
    timing: [
      { script: "Tentu. Boleh saya tanya, kapan kira-kira waktu yang paling nyaman untuk kita follow up? Saya akan sesuaikan dengan jadwal Bapak/Ibu.", tips: "Minta jadwal konkret agar tidak menggantung.", tone: "formal" },
      { script: "No problem! Atau mau saya set reminder follow up minggu depan? Tinggal bilang aja kapannya.", tips: "Ambil inisiatif follow up tapi jangan memaksa.", tone: "santai" },
    ],
    already_own: [
      { script: "Bagus sekali. Boleh saya tunjukkan perbandingan data antara produk yang sekarang dengan ini? Bukan untuk menggantikan, tapi agar bisa melihat value tambahnya.", tips: "Jangan attack kompetitor — sajikan data objektif.", tone: "formal" },
      { script: "Wah, boleh kita compare bareng ga? Saya punya datanya, siapa tahu ada yang menarik.", tips: "Pendekatan kolaboratif, bukan konfrontatif.", tone: "santai" },
    ],
    busy: [
      { script: "Mohon maaf mengganggu. Saya kirimkan ringkasan singkatnya via WhatsApp — bisa dibaca kapan pun ada waktu luang.", tips: "Respek waktu mereka, kirim materi ringkas.", tone: "formal" },
      { script: "Okee tenang — saya kirim PDF-nya aja dulu. Nanti kalau ada waktu langsung cek ya!", tips: "Jangan minta meeting dulu, kirim materi.", tone: "santai" },
    ],
    price: [
      { script: "Saya mengerti. Boleh saya tunjukkan breakdown detail manfaat vs biaya agar bisa dibandingkan secara apple-to-apple?", tips: "Beri data ROI konkret, bukan sekedar argue harga.", tone: "formal" },
      { script: "Valid! Mari kita compare dulu secara detail — kadang ada benefit yang belum keliatan dari harga permukaan.", tips: "Ajak analisis bersama sebelum defend harga.", tone: "santai" },
    ],
    ghosting: [
      { script: "Selamat pagi Bapak/Ibu. Saya ingin memastikan materi yang saya kirim sudah diterima. Apakah ada yang perlu saya klarifikasi lebih lanjut?", tips: "Follow up dengan value, bukan sekedar 'udah baca belum'.", tone: "formal" },
      { script: "Halo! Cuma mau mastiin PDF-nya udah nyampe. Ada yang mau didiskusiin gak? 😊", tips: "Tetap ringan, jangan ada tekanan.", tone: "santai" },
    ],
  },
  lion: {
    not_confident: [
      { script: "Saya bisa menunjukkan langsung perbandingannya — cukup 10 menit. Bapak/Ibu bisa langsung ambil keputusan berdasarkan fakta.", tips: "Singa suka kecepatan dan action. Tawarkan demo langsung.", tone: "formal" },
      { script: "Langsung kita compare sekarang — gak lama kok. Biar bisa langsung diputusin.", tips: "Direct ke action, jangan kebanyakan pilihan.", tone: "santai" },
    ],
    timing: [
      { script: "Tentu. Perlu saya informasikan bahwa penawaran ini berlaku hingga [tanggal]. Jika berkenan, bisa direserved dulu sebelum habis.", tips: "Beri urgency konkret dengan deadline nyata.", tone: "formal" },
      { script: "Oke, tapi note ya — offer ini ada expired-nya. Mau saya reserved dulu atas nama Bapak/Ibu?", tips: "Singa butuh deadline nyata buat ambil keputusan.", tone: "santai" },
    ],
    already_own: [
      { script: "Saya paham. Izinkan saya highlight perbedaan utama yang memberikan nilai lebih — ini yang membedakan kami dari yang lain.", tips: "Langsung ke diferensiasi, jangan panjang-panjang.", tone: "formal" },
      { script: "Justru itu — kita punya keunggulan yang mungkin belum ada di sana. Mau saya tunjukkan point utamanya?", tips: "Tunjukkan value unik, jangan jelek-jelekin kompetitor.", tone: "santai" },
    ],
    busy: [
      { script: "Mohon maaf mengganggu. Hanya butuh 2 menit — saya sampaikan poin utamanya langsung.", tips: "Singa menghargai efisiensi. Langsung to the point.", tone: "formal" },
      { script: "2 menit doang — langsung poin utamanya. Deal?", tips: "Singkat, tegas, tanpa basa-basi.", tone: "santai" },
    ],
    price: [
      { script: "Selisih harga tersebut sudah mencakup [benefit spesifik]. Ini investasi yang memberikan return nyata, bukan sekadar biaya.", tips: "Reframe harga sebagai investasi dengan ROI jelas.", tone: "formal" },
      { script: "Mahal dibanding apa? Kalau hitung ROI-nya, ini justru jauh lebih worth it.", tips: "Tantang framing harga dengan logika ROI.", tone: "santai" },
    ],
    ghosting: [
      { script: "Selamat pagi. Saya ingin mengetahui apakah keputusan sudah bisa diambil pada hari ini?", tips: "Singa butuh directness. Langsung tanya status.", tone: "formal" },
      { script: "Halo! Gimana, udah ada keputusan?", tips: "Langsung tanya — mereka justru respect directness.", tone: "santai" },
    ],
  },
  dolphin: {
    not_confident: [
      { script: "Wajar sekali, ini keputusan penting. Boleh cerita bagian mana yang masih terasa belum yakin? Saya ingin bantu semaksimal mungkin.", tips: "Lumba-Lumba butuh didengar dulu sebelum diarahkan.", tone: "formal" },
      { script: "Gak masalah! Emang perlu dipikirin baik-baik. Kira-kira bagian mana yang masih ragu? Kita obrolin santai aja.", tips: "Jadikan percakapan, bukan presentasi.", tone: "santai" },
    ],
    timing: [
      { script: "Tentu tidak masalah. Saya tunggu ya. Jika kapanpun ada pertanyaan, langsung hubungi saja — saya selalu siap.", tips: "Lumba-Lumba menghargai kesabaran dan relasi jangka panjang.", tone: "formal" },
      { script: "Santai aja! Saya tunggu. Nanti kalau udah ready, langsung kabarin ya 😊", tips: "Jaga warmth, jangan beri tekanan apapun.", tone: "santai" },
    ],
    already_own: [
      { script: "Wah bagus! Boleh saya tahu produknya apa? Siapa tahu kita bisa lihat apakah keduanya justru bisa saling melengkapi.", tips: "Ubah kompetisi menjadi kolaborasi.", tone: "formal" },
      { script: "Oh iya? Asyik! Boleh compare bareng ga? Siapa tau malah saling melengkapi 😄", tips: "Buat jadi obrolan ringan, bukan pitching.", tone: "santai" },
    ],
    busy: [
      { script: "Tentu, saya sangat mengerti. Tidak perlu terburu-buru. Kalau sudah ada waktu, saya akan follow up kembali.", tips: "Tunjukkan empati dan fleksibilitas penuh.", tone: "formal" },
      { script: "Oh iya gak apa-apa! Santai aja. Nanti saya follow up ya kalau udah agak longgar 😊", tips: "Jangan force — tunjukkan lo respect jadwal mereka.", tone: "santai" },
    ],
    price: [
      { script: "Saya mengerti. Banyak klien kami awalnya berpikir hal yang sama, namun setelah mencoba merasakan perbedaannya. Boleh saya ceritakan salah satu?", tips: "Gunakan social proof dan storytelling nyata.", tone: "formal" },
      { script: "Haha wajar banget! Dulu ada klien yang mikirnya sama persis. Tapi setelah coba, malah jadi pelanggan setia. Mau denger ceritanya?", tips: "Success story jauh lebih kuat dari argumen harga.", tone: "santai" },
    ],
    ghosting: [
      { script: "Halo Bapak/Ibu, semoga sehat selalu. Saya hanya ingin memastikan semuanya baik-baik saja dan apakah ada yang bisa saya bantu.", tips: "Mulai dengan genuine care, bukan langsung jualan.", tone: "formal" },
      { script: "Halo! Udah lama nih, gimana kabarnya? 😊 Masih ada yang bisa saya bantu?", tips: "Reconnect sebagai teman dulu, bukan sebagai sales.", tone: "santai" },
    ],
  },
  rabbit: {
    not_confident: [
      { script: "Wajar sekali merasa ragu, ini hal yang penting. Mari kita bahas satu per satu ya, biar semuanya jelas dan nyaman sebelum memutuskan.", tips: "Pecah keputusan besar jadi langkah-langkah kecil.", tone: "formal" },
      { script: "Tenang, gak perlu buru-buru. Kita bahas pelan-pelan ya. Mulai dari mana yang paling bikin ragu?", tips: "Beri ruang — jangan rush sama sekali.", tone: "santai" },
    ],
    timing: [
      { script: "Tidak masalah sama sekali. Apakah ada yang perlu saya jelaskan lebih dulu sebelum mempertimbangkannya?", tips: "Cari tahu apakah 'nanti' karena bingung atau genuinely butuh waktu.", tone: "formal" },
      { script: "No problem! Tapi boleh nanya, ada yang masih bikin ragu gak? Siapa tau bisa saya bantu jelasin dulu 😊", tips: "Gali alasan di balik kata 'nanti'.", tone: "santai" },
    ],
    already_own: [
      { script: "Tentu. Tidak perlu khawatir — memiliki dua pilihan justru sering menguntungkan. Boleh saya jelaskan bagaimana keduanya bisa saling melengkapi?", tips: "Hilangkan ketakutan akan 'salah pilih'.", tone: "formal" },
      { script: "Aman kok! Banyak yang pegang dua-duanya dan justru lebih untung. Mau saya jelasin caranya?", tips: "Reassure bahwa ini keputusan yang aman.", tone: "santai" },
    ],
    busy: [
      { script: "Tentu tidak masalah. Boleh saya kirimkan ringkasan singkat yang bisa dibaca kapan pun ada waktu?", tips: "Kurangi friction — beri opsi yang termudah.", tone: "formal" },
      { script: "Gak apa-apa! Mau saya kirim ringkasannya dulu aja? Bisa dibaca santai kapanpun 😊", tips: "Make it as easy as possible for them to engage.", tone: "santai" },
    ],
    price: [
      { script: "Saya mengerti. Sebenarnya ada paket yang lebih terjangkau sebagai langkah awal. Risikonya sangat minimal. Boleh saya jelaskan?", tips: "Tawarkan entry-level option untuk kurangi rasa risiko.", tone: "formal" },
      { script: "Wajar banget! Ada paket yang lebih kecil buat nyoba dulu kok — risikonya minim. Mau saya ceritain?", tips: "Lower the barrier to entry sebanyak mungkin.", tone: "santai" },
    ],
    ghosting: [
      { script: "Halo Bapak/Ibu, saya ingin memastikan tidak ada kebingungan dari informasi yang sebelumnya saya sampaikan. Ada yang ingin ditanyakan?", tips: "Mereka mungkin ghosting karena takut terlihat bingung.", tone: "formal" },
      { script: "Halo! Mau mastiin aja — ada yang bikin bingung dari info sebelumnya gak? Gak ada yang salah nanya kok 😊", tips: "Beri safe space untuk bertanya tanpa malu.", tone: "santai" },
    ],
  },
};
