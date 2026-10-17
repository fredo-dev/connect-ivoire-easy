# Connect Ivoire Easy

626f6c742d63632d6167656e74Le fichier `.bolt/prompt` est vide — il n'y a pas de prompt d'origine enregistré. Le projet a été créé avec le template Bolt Vite + React + TypeScript, puis construit au fil des conversations précédentes.

Voici le prompt qui décrit l'application telle qu'elle existe aujourd'hui :

> Crée une application web pour la gestion d'une cabine téléphonique en Côte d'Ivoire, appelée "Cabine Online". L'app permet aux clients de souscrire à des forfaits internet et appels (Orange, MTN, Moov, Wave) et de recharger leur crédit téléphonique. Les paiements sont intégrés via l'API Jèko (Mobile Money). L'app inclut :

>

> - **Authentification** : inscription/connexion par email et mot de passe (Supabase Auth)

> - **Tableau de bord** : vue d'ensemble avec solde, forfaits actifs, bonus

> - **Forfaits** : liste de forfaits internet, appels et mixtes, filtrables par type, avec paiement Jèko (frais de service 1,5 %)

> - **Recharge de crédit** : transfert de crédit vers le numéro de l'opérateur du client (frais 1,5 %)

> - **Transactions** : historique des paiements et transferts

> - **Bonus** : système de bonus et récompenses

> - **Parrainage** : programme de referral avec bonus pour le parrain

> - **Quiz** : quiz interactif pour gagner des bonus

> - **Profil** : gestion du profil avec numéro de téléphone et opérateur

>

> Design : thème sombre moderne, couleur principale orange, interface en français, responsive mobile-first. Utilise Supabase pour la base de données, l'authentification et les edge functions (paiement Jèko, vérification de statut, transfert de crédit). Frais de service conformes à 1,5 %.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://connect-ivoire-easy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/36c870ab-c70b-4954-91f5-8cc25a904962).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
