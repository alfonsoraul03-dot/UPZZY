/**
 * Privacy policy and terms, shown in the app (/legal/privacy, /legal/terms)
 * and pasted on upzzyworld.com for the store listings. Keep both in sync.
 */

/** Where people write to us: upzzy customer service. */
export const CONTACT_EMAIL = 'upzzy.1@gmail.com';
export const UPDATED = '21 october 2026';

export type LegalDoc = { title: string; sections: { heading: string; body: string[] }[] };

export const PRIVACY: LegalDoc = {
  title: 'privacy',
  sections: [
    {
      heading: 'who we are',
      body: [
        'upzzy is a streetwear brand. this app is for people who own an upzzy piece. we decide how your data is used, and only for running the app.',
      ],
    },
    {
      heading: 'what we keep',
      body: [
        'your account: the email apple, google or you give us when you sign in, and the username you pick.',
        'what you post: challenge photos, reaction selfies, captions, likes, follows, reports, blocks and messages with friends.',
        'your garment code, so each code is used once.',
        "your phone's push token, so we can tell you when the challenge drops.",
        'basic records of sensitive actions (like reviewing photos or deleting an account), to keep the app safe.',
        'we do not sell your data, show ads, or track you across other apps.',
      ],
    },
    {
      heading: 'who sees it',
      body: [
        'photos and your username are seen by other members. messages are seen only by you and the friend you talk to. reports are seen only by our staff.',
        'staff look at challenge photos to check an upzzy piece is in them before points count.',
      ],
    },
    {
      heading: 'services we use',
      body: [
        'supabase stores the app data and photos. expo sends push notifications. apple and google handle sign in if you use them. each one only gets what it needs to do that job.',
      ],
    },
    {
      heading: 'how long',
      body: [
        'until you delete your account. you can do it any time in the app: you → delete account. it removes your photos, posts, likes, follows and messages right away.',
      ],
    },
    {
      heading: 'your rights',
      body: [
        `you can ask to see, fix, export or delete your data, or object to how we use it. write to ${CONTACT_EMAIL} and we answer within 30 days. if you are in the eu you can also complain to your data protection authority (in spain, the aepd).`,
        'upzzy is for people 16 and over.',
      ],
    },
    {
      heading: 'contact',
      body: [`upzzy customer service: ${CONTACT_EMAIL}. we update this page when something changes. last update: ${UPDATED}.`],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'terms',
  sections: [
    {
      heading: 'the deal',
      body: [
        'by using upzzy you agree to these terms. you need to be 16 or over and to have unlocked the app with the code from an upzzy piece.',
      ],
    },
    {
      heading: 'zero tolerance',
      body: [
        'no nudity, violence, hate, harassment, threats, spam, or anything illegal. no photos of people who did not agree to it.',
        'anyone can report a photo or block a person from its menu. three reports hide a photo at once. our staff look at every report within 24 hours, remove what breaks these rules and ban the people who posted it.',
      ],
    },
    {
      heading: 'your photos',
      body: [
        'your photos stay yours. you let us show them inside the app, and on upzzy channels only if we ask you first.',
        'you can delete your account and everything in it whenever you want.',
      ],
    },
    {
      heading: 'points and prizes',
      body: [
        'points are just for the ranking. they have no money value and cannot be sold or swapped. only photos with an upzzy piece count, checked by our staff.',
        "every month the top 3 of the global ranking win a free upzzy piece. staff check the winners' photos and points before sending it, and we write to winners by email.",
        'cheating (fake accounts, bought likes, someone else in your photo) removes the points, any prize, and can end the account.',
      ],
    },
    {
      heading: 'codes',
      body: ['each code in a package works once, for one account. lost or shared codes are not replaced.'],
    },
    {
      heading: 'the app',
      body: [
        'we keep improving upzzy and can change or stop features. we can close accounts that break these terms. the app comes as is; we are not responsible for what other members post, but we act on it when it is reported.',
      ],
    },
    {
      heading: 'contact',
      body: [`questions: upzzy customer service, ${CONTACT_EMAIL}. last update: ${UPDATED}.`],
    },
  ],
};
