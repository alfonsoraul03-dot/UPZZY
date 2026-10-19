import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { haptic } from '@/lib/haptics';
import {
  blockUser,
  friendlyError,
  getFeed,
  getTodayChallenge,
  myPost,
  photoUrls,
  reportPost,
  setFollowing,
  setLiked,
  sharePhoto,
  type Challenge,
} from '@/lib/social';
import { displayName, isDoubleTap, likesLabel, toggleLike, type FeedPost, type FeedScope } from '@/social/rules';
import { fonts, layout, radius, space, useTheme } from '@/theme';

type Load = 'loading' | 'ready' | 'error';

/** Today's challenge as a full-screen feed: swipe up for the next photo, double tap to like. */
export default function OopsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, ready, configured } = useSession();
  const [scope, setScope] = useState<FeedScope>('global');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [load, setLoad] = useState<Load>('loading');
  const [error, setError] = useState('');
  const [posted, setPosted] = useState(false);
  const [end, setEnd] = useState(false);
  const [height, setHeight] = useState(0);
  const [menuFor, setMenuFor] = useState<FeedPost | null>(null);
  const loadingMore = useRef(false);
  // Bumped on every refresh so the list remounts at the top (newest first).
  const [version, setVersion] = useState(0);

  const refresh = useCallback(
    async (nextScope: FeedScope) => {
      if (!configured || !ready) return;
      try {
        const today = await getTodayChallenge();
        setChallenge(today);
        if (!today || (nextScope === 'friends' && !userId)) {
          setPosts([]);
          setEnd(true);
          setLoad('ready');
          return;
        }
        const [page, mine] = await Promise.all([
          getFeed(today.id, nextScope),
          userId ? myPost(today.id, userId) : Promise.resolve(null),
        ]);
        setUrls(await photoUrls(page.map((p) => p.image_path)));
        setPosts(page);
        setVersion((v) => v + 1);
        setPosted(!!mine);
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

  const loadMore = async () => {
    if (!challenge || end || loadingMore.current || !posts.length) return;
    loadingMore.current = true;
    try {
      const page = await getFeed(challenge.id, scope, posts[posts.length - 1].created_at);
      const more = await photoUrls(page.map((p) => p.image_path));
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
    if (next === scope) return;
    haptic('tap');
    setScope(next);
    setLoad('loading');
    setPosts([]);
  };

  const needAccount = () => {
    if (userId) return false;
    router.push('/account');
    return true;
  };

  const like = async (post: FeedPost, only?: 'like') => {
    if (needAccount()) return;
    if (only === 'like' && post.liked) return;
    haptic('tap');
    const next = toggleLike(post);
    setPosts((all) => all.map((p) => (p.id === post.id ? next : p)));
    try {
      await setLiked(post.id, next.liked);
    } catch {
      setPosts((all) => all.map((p) => (p.id === post.id ? post : p)));
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

  const top = (
    <View
      style={[styles.top, { paddingTop: insets.top + space.sm, backgroundColor: posts.length ? theme.photoScrim : 'transparent' }]}
      pointerEvents="box-none">
      <View style={styles.scopes}>
        {(['global', 'friends'] as const).map((s) => (
          <Pressable key={s} onPress={() => switchScope(s)} accessibilityRole="tab" accessibilityState={{ selected: scope === s }} hitSlop={8}>
            <Text
              style={{
                color: posts.length ? theme.onPhoto : theme.text,
                opacity: scope === s ? 1 : 0.6,
                fontFamily: scope === s ? fonts.bodySemiBold : fonts.body,
                fontSize: 16,
              }}>
              {s}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => router.push('/account')} accessibilityRole="button" hitSlop={8}>
        <Text style={{ color: posts.length ? theme.onPhoto : theme.textMuted, fontSize: 15 }}>{userId ? 'you' : 'sign in'}</Text>
      </Pressable>
    </View>
  );

  if (!configured) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <Text variant="title">the feed isn&apos;t connected yet.</Text>
        <Text color="textMuted" style={styles.centerText}>
          add the supabase keys to .env. the steps are in the readme.
        </Text>
      </View>
    );
  }

  const takeYours = !posted && challenge ? (
    <Button
      label="take yours"
      onPress={() => {
        if (!needAccount()) router.push('/capture');
      }}
      style={styles.cta}
    />
  ) : null;

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
        <Text variant="title">no challenge today.</Text>
        <Text color="textMuted">back tomorrow.</Text>
      </View>
    );
  } else if (!posts.length) {
    body = (
      <View style={styles.center}>
        <Text variant="label" color="textMuted">
          today
        </Text>
        <Text variant="title" style={styles.centerText}>
          {challenge.title}
        </Text>
        {challenge.description ? (
          <Text color="textMuted" style={styles.centerText}>
            {challenge.description}
          </Text>
        ) : null}
        <Text color="textMuted" style={styles.centerText}>
          {scope === 'friends'
            ? userId
              ? 'nobody you follow posted yet.'
              : 'sign in to see friends.'
            : 'no one yet. be the first.'}
        </Text>
        {takeYours}
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
                url={urls[item.image_path]}
                height={height}
                challenge={challenge}
                isMine={item.user_id === userId}
                onLike={like}
                onFollow={follow}
                onMore={setMenuFor}
              />
            )}
          />
        ) : null}
        {takeYours ? (
          <Pressable
            onPress={() => {
              if (!needAccount()) router.push('/capture');
            }}
            accessibilityRole="button"
            accessibilityLabel="take yours"
            style={({ pressed }) => [
              styles.floating,
              { backgroundColor: theme.photoScrim, borderColor: theme.onPhoto, opacity: pressed ? 0.75 : 1 },
            ]}>
            <Text style={[styles.floatingLabel, { color: theme.onPhoto }]}>take yours</Text>
          </Pressable>
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

function PostPage({
  post,
  url,
  height,
  challenge,
  isMine,
  onLike,
  onFollow,
  onMore,
}: {
  post: FeedPost;
  url: string | undefined;
  height: number;
  challenge: Challenge;
  isMine: boolean;
  onLike: (post: FeedPost, only?: 'like') => void;
  onFollow: (post: FeedPost) => void;
  onMore: (post: FeedPost) => void;
}) {
  const theme = useTheme();
  const lastTap = useRef(0);
  const pop = useRef(new Animated.Value(0)).current;

  const onPress = () => {
    const now = Date.now();
    if (isDoubleTap(lastTap.current, now)) {
      lastTap.current = 0;
      onLike(post, 'like');
      pop.setValue(0);
      Animated.sequence([
        Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(pop, { toValue: 0, duration: 260, delay: 350, useNativeDriver: true }),
      ]).start();
    } else {
      lastTap.current = now;
    }
  };

  const onPhoto = { color: theme.onPhoto };

  return (
    <Pressable onPress={onPress} style={{ height, backgroundColor: theme.surface }} accessibilityLabel={`photo by ${displayName(post.username)}`}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}

      <Animated.View pointerEvents="none" style={[styles.pop, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }, { rotate: '-4deg' }] }]}>
        <Text style={[styles.popText, onPhoto]}>liked.</Text>
      </Animated.View>

      <View style={[styles.band, styles.challengeBand, { backgroundColor: theme.photoScrim }]}>
        <Text variant="label" style={onPhoto}>
          today
        </Text>
        <Text variant="bodyStrong" style={onPhoto} numberOfLines={2}>
          {challenge.title}
        </Text>
      </View>

      <View style={[styles.band, styles.bottomBand, { backgroundColor: theme.photoScrim }]}>
        <View style={styles.nameRow}>
          <Text variant="bodyStrong" style={onPhoto}>
            {isMine ? 'you' : displayName(post.username)}
          </Text>
          {!isMine ? (
            <Pressable onPress={() => onFollow(post)} accessibilityRole="button" hitSlop={10}>
              <Text style={[onPhoto, styles.follow]}>{post.following ? 'following' : 'follow'}</Text>
            </Pressable>
          ) : null}
        </View>
        {post.caption ? (
          <Text style={onPhoto} numberOfLines={3}>
            {post.caption}
          </Text>
        ) : null}
        <View style={styles.actionsRow}>
          <Pressable onPress={() => onLike(post)} accessibilityRole="button" accessibilityState={{ selected: post.liked }} hitSlop={10}>
            <Text style={[onPhoto, post.liked ? styles.liked : null]}>
              {post.liked ? 'liked · ' : 'like · '}
              {likesLabel(post.like_count)}
            </Text>
          </Pressable>
          {isMine ? (
            url ? (
              <Pressable onPress={() => sharePhoto(url, post.id).catch(() => {})} accessibilityRole="button" hitSlop={12}>
                <Text style={[onPhoto, styles.liked]}>share</Text>
              </Pressable>
            ) : null
          ) : (
            <Pressable onPress={() => onMore(post)} accessibilityRole="button" accessibilityLabel="more" hitSlop={12}>
              <Text style={onPhoto}>···</Text>
            </Pressable>
          )}
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
  cta: { marginTop: space.lg, minWidth: 180 },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: layout.gutter,
    paddingBottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scopes: { flexDirection: 'row', gap: space.xl },
  band: { position: 'absolute', left: space.md, right: space.md, borderRadius: radius.md, padding: space.md, gap: space.xs },
  challengeBand: { top: 72 },
  bottomBand: { bottom: space.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  follow: { fontFamily: fonts.bodySemiBold, textDecorationLine: 'underline' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  liked: { fontFamily: fonts.bodySemiBold },
  pop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  popText: { fontFamily: fonts.display, fontSize: 56, letterSpacing: -1 },
  // Over photos the normal button can vanish into the picture, so this one sits on the scrim.
  floating: {
    position: 'absolute',
    right: layout.gutter,
    bottom: 150,
    minHeight: 54,
    paddingHorizontal: space.xxl,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingLabel: { fontFamily: fonts.bodySemiBold, fontSize: 16 },
  menu: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: layout.gutter,
    gap: space.md,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
});
