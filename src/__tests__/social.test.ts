import {
  CAPTION_MAX,
  displayName,
  isDoubleTap,
  isEmail,
  isLoginCode,
  isPlaceholderUsername,
  likesLabel,
  normalizeCaption,
  photoPath,
  toggleLike,
  type FeedPost,
} from '@/social/rules';

const post: FeedPost = {
  id: 'p',
  user_id: 'u',
  username: 'uno',
  image_path: 'u/c-a.jpg',
  caption: null,
  like_count: 2,
  created_at: '2026-10-19T10:00:00Z',
  liked: false,
  following: false,
};

describe('social rules', () => {
  it('cleans captions and keeps them short', () => {
    expect(normalizeCaption('   ')).toBeNull();
    expect(normalizeCaption('  one   wrong  thing ')).toBe('one wrong thing');
    expect(normalizeCaption('x'.repeat(200))).toHaveLength(CAPTION_MAX);
  });

  it('puts photos in the uploader folder, matching the server rule', () => {
    expect(photoPath('user-1', 'chal-1', 'abc123')).toBe('user-1/chal-1-abc123.jpg');
    expect(photoPath('user-1', 'chal-1', '../../x')).toBe('user-1/chal-1-x.jpg');
    expect(photoPath('user-1', 'chal-1', '')).toBe('user-1/chal-1-photo.jpg');
  });

  it('spots placeholder usernames', () => {
    expect(isPlaceholderUsername('member0123456789ab')).toBe(true);
    expect(isPlaceholderUsername(null)).toBe(true);
    expect(isPlaceholderUsername('raul')).toBe(false);
    expect(displayName('member0123456789ab')).toBe('someone');
    expect(displayName('raul')).toBe('@raul');
  });

  it('checks email and login codes', () => {
    expect(isEmail('raul@upzzy.com')).toBe(true);
    expect(isEmail('raul@upzzy')).toBe(false);
    expect(isLoginCode('123456')).toBe(true);
    expect(isLoginCode('12345')).toBe(false);
    expect(isLoginCode('12a456')).toBe(false);
  });

  it('toggles likes without going negative', () => {
    const liked = toggleLike(post);
    expect(liked).toMatchObject({ liked: true, like_count: 3 });
    expect(toggleLike(liked)).toMatchObject({ liked: false, like_count: 2 });
    expect(toggleLike({ ...post, liked: true, like_count: 0 }).like_count).toBe(0);
  });

  it('detects double taps', () => {
    expect(isDoubleTap(1000, 1200)).toBe(true);
    expect(isDoubleTap(1000, 1400)).toBe(false);
    expect(isDoubleTap(0, 0)).toBe(false);
  });

  it('writes like counts in plain words', () => {
    expect(likesLabel(0)).toBe('no likes yet');
    expect(likesLabel(1)).toBe('1 like');
    expect(likesLabel(12)).toBe('12 likes');
  });
});
