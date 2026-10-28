import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MistakeNotice } from '@/components/social/MistakeNotice';
import { Avatar, Button, Icon, Shade, Text, Toggle } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { haptic } from '@/lib/haptics';
import { pushState, turnOnPush, type PushState } from '@/lib/push';
import {
  blockUser,
  friendlyError,
  getFeed,
  getLatestChallenge,
  getToday,
  myPost,
  photoUrls,
  reportPost,
  setFollowing,
  setLiked,
  sharePhoto,
  type Challenge,
} from '@/lib/social';
import {
  displayName,
  isDoubleTap,
  lateLabel,
  minutesBetween,
  pointsFor,
  pointsLabel,
  shortDay,
  type FeedPost,
  type FeedScope,
} from '@/social/rules';
import { fonts, layout, radius, space, useTheme } from '@/theme';

type Load = 'loading' | 'ready' | 'error';

const SCOPES = ['friends', 'global'] as const;

/**
 * Home: today's challenge photos, one per screen. Swipe up for the next,
 * double tap to like, the camera button to react with a selfie. While today's challenge is still a
 * secret, yesterday's photos stay up.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, ready, configured } = useSession();
  const [scope, setScope] = useState<FeedScope>('global');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isToday, setIsToday] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [load, setLoad] = useState<Load>('loading');
  const [error, setError] = useState('');
  const [posted, setPosted] = useState(false);
  // Staff found no UPZZY in today's photo: it came down and the day is spent.
  const [missed, setMissed] = useState(false);
  const [end, setEnd] = useState(false);
  const [height, setHeight] = useState(0);
  const [menuFor, setMenuFor] = useState<FeedPost | null>(null);
  const [now, setNow] = useState(() => new Date());
  // Bumped on every refresh so the list remounts at the top (newest first).
  const [version, setVersion] = useState(0);
  const loadingMore = useRef(false);

  const refresh = useCallback(
    async (nextScope: FeedScope) => {
      if (!configured || !ready) return;
      try {
        const [today, latest] = await Promise.all([getToday(), getLatestChallenge()]);
        const todayOpen = !!today?.is_open && latest?.id === today.id;
        setChallenge(latest);
        setIsToday(todayOpen);
        setNow(new Date());
        if (!latest || (nextScope === 'friends' && !userId)) {
          setPosts([]);
          setEnd(true);
          setLoad('ready');
          return;
        }
        const [page, mine] = await Promise.all([
          getFeed(latest.id, nextScope),
          userId && todayOpen ? myPost(latest.id, userId) : Promise.resolve(null),
        ]);
        setUrls(await photoUrls(pathsOf(page)));
        setPosts(page);
        setVersion((v) => v + 1);
        setPosted(!!mine);
        setMissed(mine?.review === 'rejected');
        setEnd(page.length === 0);
        setLoad('ready');
      } catch (e) {
        setError(friendlyError(e));
        setLoad('error');
      }
    },
    [configured, ready, userId],
  );

  useFocusEffect(
    useCallback(() => {
      refresh(scope);
    }, [refresh, scope]),
  );

  // Points tick down while you wait, so keep the number on the button fresh.
  const counting = isToday && !posted;
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [counting]);

  const loadMore = async () => {
    if (!challenge || end || loadingMore.current || !posts.length) return;
    loadingMore.current = true;
    try {
      const page = await getFeed(challenge.id, scope, posts[posts.length - 1].created_at);
      const more = await photoUrls(pathsOf(page));
      setUrls((u) => ({ ...u, ...more }));
      setPosts((p) => [...p, ...page.filter((n) => !p.some((o) => o.id === n.id))]);
      if (!page.length) setEnd(true);
    } catch {
      // Keep what is on screen; the next scroll to the end tries again.
    } finally {
      loadingMore.current = false;
    }
  };

  const switchScope = (next: FeedScope) => {
    setScope(next);
    setLoad('loading');
    setPosts([]);
  };

  const needAccount = () => {
    if (userId) return false;
    router.push('/account');
    return true;
  };

  const takeYours = () => {
    if (!needAccount()) router.push('/capture');
  };

  const react = (post: FeedPost) => {
    if (needAccount()) return;
    haptic('tap');
    router.push({ pathname: '/react', params: { post: post.id, name: displayName(post.username) } });
  };

  const like = async (post: FeedPost, only?: 'like') => {
    if (needAccount() || !userId || post.user_id === userId) return;
    const liked = only === 'like' ? true : !post.liked;
    if (liked === post.liked) return;
    haptic('tap');
    const apply = (value: boolean) =>
      setPosts((all) =>
        all.map((p) => (p.id === post.id ? { ...p, liked: value, like_count: Math.max(0, p.like_count + (value ? 1 : -1)) } : p)),
      );
    apply(liked);
    try {
      await setLiked(post.id, liked, userId);
    } catch {
      apply(!liked);
    }
  };

  const follow = async (post: FeedPost) => {
    if (needAccount() || !userId || post.user_id === userId) return;
    haptic('tap');
    const following = !post.following;
    const apply = (value: boolean) =>
      setPosts((all) => all.map((p) => (p.user_id === post.user_id ? { ...p, following: value } : p)));
    apply(following);
    try {
      await setFollowing(post.user_id, following, userId);
    } catch {
      apply(!following);
    }
  };

  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);

  if (!configured) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <Text variant="title">not connected yet.</Text>
        <Text color="textMuted" style={styles.centerText}>
          add the supabase keys to .env. the steps are in the readme.
        </Text>
      </View>
    );
  }

  const worth = challenge && counting ? pointsFor(minutesBetween(challenge.opens_at, now), challenge.max_points) : 0;
  const hasPhotos = posts.length > 0 && load === 'ready';

  const top = (
    <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
      <Toggle options={SCOPES} value={scope} onChange={switchScope} onPhoto={hasPhotos} />
      {missed && isToday ? <MistakeNotice /> : null}
      {challenge && hasPhotos ? (
        <View style={styles.pills} pointerEvents="box-none">
          <View style={[styles.pill, { backgroundColor: theme.photoScrim }]}>
            <Text variant="caption" style={[styles.pillText, { color: theme.onPhoto }]} numberOfLines={1}>
              {isToday ? 'today' : shortDay(challenge.day)} · {challenge.title}
            </Text>
          </View>
          {counting ? (
            <Pressable
              onPress={takeYours}
              accessibilityRole="button"
              accessibilityLabel="take yours"
              style={({ pressed }) => [styles.pill, { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 }]}>
              <Text variant="caption" style={[styles.pillText, { color: theme.onText }]}>
                take yours · {worth} pts
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const waitingLine = "today's oops isn't out yet. it drops at a random time. be quick.";

  let body: React.ReactNode;
  if (load === 'loading') {
    body = (
      <View style={styles.center}>
        <Text color="textMuted">loading…</Text>
      </View>
    );
  } else if (load === 'error') {
    body = (
      <View style={styles.center}>
        <Text variant="title">{error}</Text>
        <Button label="try again" variant="outline" onPress={() => refresh(scope)} style={styles.cta} />
      </View>
    );
  } else if (!challenge) {
    body = (
      <View style={styles.center}>
        <Text variant="heading" style={styles.centerText}>
          not out yet.
        </Text>
        <Text color="textMuted" style={styles.centerText}>
          {waitingLine}
        </Text>
        <DropAlert />
      </View>
    );
  } else if (!posts.length) {
    body = (
      <View style={styles.center}>
        <Text variant="label" color="textMuted">
          {isToday ? 'today' : shortDay(challenge.day)}
        </Text>
        <Text variant="heading" style={styles.centerText}>
          {challenge.title}
        </Text>
        {challenge.description ? (
          <Text color="textMuted" style={styles.centerText}>
            {challenge.description}
          </Text>
        ) : null}
        <Text color="textMuted" style={styles.centerText}>
          {!isToday
            ? waitingLine
            : scope === 'friends'
              ? userId
                ? 'nobody you follow posted yet.'
                : 'sign in to see friends.'
              : 'no one yet. be the first.'}
        </Text>
        {counting ? <Button label={`take yours · ${worth} pts`} onPress={takeYours} style={styles.cta} /> : null}
        {!isToday ? <DropAlert /> : null}
      </View>
    );
  } else {
    body = (
      <View style={styles.fill}>
        {height > 0 ? (
          <FlatList
            key={version}
            data={posts}
            keyExtractor={(p) => p.id}
            pagingEnabled
            snapToInterval={height}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={2}
            getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
            renderItem={({ item }) => (
              <PostPage
                post={item}
                urls={urls}
                height={height}
                challenge={challenge}
                isMine={item.user_id === userId}
                onReact={react}
                onLike={like}
                onFollow={follow}
                onMore={setMenuFor}
              />
            )}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]} onLayout={onLayout}>
      {body}
      {top}
      {menuFor ? (
        <PostMenu
          post={menuFor}
          onClose={() => setMenuFor(null)}
          onDone={(hideUser) => {
            setPosts((all) => all.filter((p) => (hideUser ? p.user_id !== menuFor.user_id : p.id !== menuFor.id)));
            setMenuFor(null);
          }}
        />
      ) : null}
    </View>
  );
}

function pathsOf(posts: FeedPost[]): string[] {
  return posts.flatMap((p) => [p.image_path, ...p.reactions.map((r) => r.image_path)]);
}

function PostPage({
  post,
  urls,
  height,
  challenge,
  isMine,
  onReact,
  onLike,
  onFollow,
  onMore,
}: {
  post: FeedPost;
  urls: Record<string, string>;
  height: number;
  challenge: Challenge;
  isMine: boolean;
  onReact: (post: FeedPost) => void;
  onLike: (post: FeedPost, only?: 'like') => void;
  onFollow: (post: FeedPost) => void;
  onMore: (post: FeedPost) => void;
}) {
  const theme = useTheme();
  const lastTap = useRef(0);
  const url = urls[post.image_path];
  const onPhoto = [styles.shadow, { color: theme.onPhoto, textShadowColor: theme.photoShadow }];
  const openProfile = () => router.push({ pathname: '/user/[id]', params: { id: post.user_id } });

  const onPress = () => {
    const at = Date.now();
    if (isDoubleTap(lastTap.current, at)) {
      lastTap.current = 0;
      // Double tap likes, like on TikTok. It never unlikes.
      if (!isMine) onLike(post, 'like');
    } else {
      lastTap.current = at;
    }
  };

  const faces = post.reactions.slice(0, 3);

  return (
    <Pressable onPress={onPress} style={{ height, backgroundColor: theme.surface }} accessibilityLabel={`photo by ${displayName(post.username)}`}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
      <Shade from="top" height={190} strength={0.55} />
      <Shade from="bottom" height={340} strength={0.8} />

      <View style={styles.side}>
        <View style={styles.author}>
          <Pressable onPress={openProfile} accessibilityRole="link" accessibilityLabel={`profile of ${displayName(post.username)}`}>
            <Avatar name={post.username} size={50} ring={theme.onPhoto} />
          </Pressable>
          {!isMine && !post.following ? (
            <Pressable
              onPress={() => onFollow(post)}
              accessibilityRole="button"
              accessibilityLabel="follow"
              hitSlop={8}
              style={[styles.followBadge, { backgroundColor: theme.text }]}>
              <Icon name="plus" color={theme.onText} size={14} weight={3} />
            </Pressable>
          ) : null}
        </View>

        {!isMine ? (
          <Pressable
            onPress={() => onLike(post)}
            accessibilityRole="button"
            accessibilityLabel={post.liked ? 'unlike' : 'like'}
            accessibilityState={{ selected: post.liked }}
            style={styles.action}>
            <Icon name="heart" color={theme.onPhoto} size={34} weight={2} filled={post.liked} />
            <Text style={[styles.actionLabel, onPhoto]}>{post.like_count}</Text>
          </Pressable>
        ) : (
          <View style={styles.action} accessibilityLabel={`${post.like_count} likes`}>
            <Icon name="heart" color={theme.onPhoto} size={34} weight={2} />
            <Text style={[styles.actionLabel, onPhoto]}>{post.like_count}</Text>
          </View>
        )}

        {!isMine ? (
          <Pressable onPress={() => onReact(post)} accessibilityRole="button" accessibilityLabel="react with a selfie" style={styles.action}>
            <Icon name="camera" color={theme.onPhoto} size={34} weight={2} />
            <Text style={[styles.actionLabel, onPhoto]}>{post.my_reaction ? 'again' : 'react'}</Text>
          </Pressable>
        ) : null}

        <View style={styles.action} accessibilityLabel={`${post.reaction_count} reactions`}>
          {faces.length ? (
            faces.map((r, i) => (
              <Image
                key={r.image_path}
                source={urls[r.image_path] ? { uri: urls[r.image_path] } : undefined}
                style={[styles.face, { borderColor: theme.onPhoto, backgroundColor: theme.surface, marginTop: i ? -10 : 0 }]}
                contentFit="cover"
                accessibilityLabel={`reaction from ${displayName(r.username)}`}
              />
            ))
          ) : (
            <View style={[styles.face, styles.noFace, { borderColor: theme.onPhoto }]} />
          )}
          <Text style={[styles.actionLabel, onPhoto]}>{post.reaction_count}</Text>
        </View>

        {url ? (
          <Pressable onPress={() => sharePhoto(url, post.id).catch(() => {})} accessibilityRole="button" accessibilityLabel="share" style={styles.action}>
            <Icon name="share" color={theme.onPhoto} size={30} weight={2} />
            <Text style={[styles.actionLabel, onPhoto]}>share</Text>
          </Pressable>
        ) : null}

        {!isMine ? (
          <Pressable onPress={() => onMore(post)} accessibilityRole="button" accessibilityLabel="more" hitSlop={10} style={styles.action}>
            <Icon name="dots" color={theme.onPhoto} size={28} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.caption}>
        <Pressable onPress={openProfile} accessibilityRole="link" hitSlop={6}>
          <Text style={[styles.name, onPhoto]}>{isMine ? 'you' : displayName(post.username)}</Text>
        </Pressable>
        {post.caption ? (
          <Text style={onPhoto} numberOfLines={3}>
            {post.caption}
          </Text>
        ) : null}
        <View style={[styles.points, { backgroundColor: theme.onPhoto }]}>
          <Text style={[styles.pointsText, { color: theme.onText }]}>
            {pointsLabel(post.points, post.review, lateLabel(minutesBetween(challenge.opens_at, post.created_at)))}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Report or block, in the app (no system alerts, so it also works on the web). */
function PostMenu({ post, onClose, onDone }: { post: FeedPost; onClose: () => void; onDone: (hideUser: boolean) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>, hideUser: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      haptic('tap');
      onDone(hideUser);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.photoScrim }]} onPress={onClose} accessibilityLabel="close">
      <Pressable style={[styles.menu, { backgroundColor: theme.background, paddingBottom: insets.bottom + space.lg }]}>
        <Text variant="label" color="textMuted">
          {displayName(post.username)}
        </Text>
        <Button label="report: spam" variant="outline" disabled={busy} onPress={() => run(() => reportPost(post.id, 'spam'), false)} />
        <Button label="report: not ok" variant="outline" disabled={busy} onPress={() => run(() => reportPost(post.id, 'other'), false)} />
        <Button label="block this person" variant="outline" disabled={busy} onPress={() => run(() => blockUser(post.user_id), true)} />
        <Button label="cancel" disabled={busy} onPress={onClose} />
        {error ? <Text color="textMuted">{error}</Text> : null}
      </Pressable>
    </Pressable>
  );
}

/** While waiting for the drop: ask once to be told when it lands. */
function DropAlert() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'));
  }, []);

  if (state === 'ask')
    return (
      <Button
        label={busy ? 'one sec…' : 'ping me when it drops'}
        variant="outline"
        disabled={busy}
        style={styles.cta}
        onPress={async () => {
          setBusy(true);
          setState(await turnOnPush().catch((): PushState => 'ask'));
          setBusy(false);
        }}
      />
    );
  if (state === 'on')
    return (
      <Text variant="caption" color="textMuted" style={styles.centerText}>
        {"we'll ping you when it drops."}
      </Text>
    );
  if (state === 'off')
    return (
      <Text variant="caption" color="textMuted" style={styles.centerText}>
        pings are off. turn on notifications for upzzy in your phone settings.
      </Text>
    );
  return null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: layout.gutter,
  },
  centerText: { textAlign: 'center' },
  cta: { marginTop: space.lg, minWidth: 220 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: layout.gutter, gap: space.md },
  pills: { alignItems: 'center', gap: space.sm },
  pill: { maxWidth: '100%', paddingHorizontal: space.lg, paddingVertical: 7, borderRadius: radius.pill },
  pillText: { fontFamily: fonts.bodyBold },
  shadow: { textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  side: { position: 'absolute', right: space.md, bottom: space.xl, alignItems: 'center', gap: space.xl },
  author: { alignItems: 'center', marginBottom: space.sm },
  followBadge: { position: 'absolute', bottom: -10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  action: { alignItems: 'center', gap: 3 },
  actionLabel: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 15 },
  face: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  noFace: { borderStyle: 'dashed' },
  caption: { position: 'absolute', left: space.lg, right: 92, bottom: space.xl, gap: space.sm, alignItems: 'flex-start' },
  name: { fontFamily: fonts.bodyHeavy, fontSize: 18, lineHeight: 23 },
  points: { borderRadius: radius.sm + 4, paddingHorizontal: space.sm, paddingVertical: 4 },
  pointsText: { fontFamily: fonts.bodyHeavy, fontSize: 12, lineHeight: 15, letterSpacing: 0.3, textTransform: 'uppercase' },
  menu: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: layout.gutter,
    gap: space.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
});
