export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-bold mb-2">Page non trouvée</h2>
      <p className="text-gray-600 mb-4">La page demandée n&apos;existe pas.</p>
      <a
        href="/"
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
      >
        Retour à l&apos;accueil
      </a>
    </div>
  );
}
