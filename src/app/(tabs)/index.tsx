import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text, Toggle } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { haptic } from '@/lib/haptics';
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
  sharePhoto,
  type Challenge,
} from '@/lib/social';
import {
  displayName,
  isDoubleTap,
  lateLabel,
  minutesBetween,
  pointsFor,
  shortDay,
  type FeedPost,
  type FeedScope,
} from '@/social/rules';
import { fonts, layout, radius, space, useTheme } from '@/theme';

type Load = 'loading' | 'ready' | 'error';

const SCOPES = ['global', 'friends'] as const;

/**
 * Home: today's challenge photos, one per screen. Swipe up for the next,
 * double tap to react with a selfie. While today's challenge is still a
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

  const worth = challenge && counting ? pointsFor(minutesBetween(challenge.opens_at, now)) : 0;
  const hasPhotos = posts.length > 0 && load === 'ready';

  const top = (
    <View
      style={[styles.top, { paddingTop: insets.top + space.sm, backgroundColor: hasPhotos ? theme.photoScrim : 'transparent' }]}
      pointerEvents="box-none">
      <Toggle options={SCOPES} value={scope} onChange={switchScope} onPhoto={hasPhotos} />
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
        <Text variant="title" style={styles.centerText}>
          not out yet.
        </Text>
        <Text color="textMuted" style={styles.centerText}>
          {waitingLine}
        </Text>
      </View>
    );
  } else if (!posts.length) {
    body = (
      <View style={styles.center}>
        <Text variant="label" color="textMuted">
          {isToday ? 'today' : shortDay(challenge.day)}
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
          {!isToday
            ? waitingLine
            : scope === 'friends'
              ? userId
                ? 'nobody you follow posted yet.'
                : 'sign in to see friends.'
              : 'no one yet. be the first.'}
        </Text>
        {counting ? <Button label={`take yours · ${worth} pts`} onPress={takeYours} style={styles.cta} /> : null}
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
                isToday={isToday}
                isMine={item.user_id === userId}
                onReact={react}
                onFollow={follow}
                onMore={setMenuFor}
              />
            )}
          />
        ) : null}
        {counting ? (
          <Pressable
            onPress={takeYours}
            accessibilityRole="button"
            accessibilityLabel="take yours"
            style={({ pressed }) => [
              styles.floating,
              { backgroundColor: theme.photoScrim, borderColor: theme.onPhoto, opacity: pressed ? 0.75 : 1 },
            ]}>
            <Text style={[styles.floatingLabel, { color: theme.onPhoto }]}>take yours · {worth} pts</Text>
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

function pathsOf(posts: FeedPost[]): string[] {
  return posts.flatMap((p) => [p.image_path, ...p.reactions.map((r) => r.image_path)]);
}

function PostPage({
  post,
  urls,
  height,
  challenge,
  isToday,
  isMine,
  onReact,
  onFollow,
  onMore,
}: {
  post: FeedPost;
  urls: Record<string, string>;
  height: number;
  challenge: Challenge;
  isToday: boolean;
  isMine: boolean;
  onReact: (post: FeedPost) => void;
  onFollow: (post: FeedPost) => void;
  onMore: (post: FeedPost) => void;
}) {
  const theme = useTheme();
  const lastTap = useRef(0);
  const url = urls[post.image_path];
  const onPhoto = { color: theme.onPhoto };

  const onPress = () => {
    const at = Date.now();
    if (isDoubleTap(lastTap.current, at)) {
      lastTap.current = 0;
      if (!isMine) onReact(post);
    } else {
      lastTap.current = at;
    }
  };

  const shown = post.reactions.slice(0, 5);
  const more = post.reaction_count - shown.length;

  return (
    <Pressable onPress={onPress} style={{ height, backgroundColor: theme.surface }} accessibilityLabel={`photo by ${displayName(post.username)}`}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}

      <View style={[styles.band, styles.challengeBand, { backgroundColor: theme.photoScrim }]}>
        <Text variant="label" style={onPhoto}>
          {isToday ? 'today' : shortDay(challenge.day)}
        </Text>
        <Text variant="bodyStrong" style={onPhoto} numberOfLines={2}>
          {challenge.title}
        </Text>
        {!isToday ? (
          <Text variant="caption" style={onPhoto}>
            today&apos;s drops at a random time. be quick.
          </Text>
        ) : null}
      </View>

      <View style={[styles.band, styles.bottomBand, { backgroundColor: theme.photoScrim }]}>
        <View style={styles.row}>
          <Pressable
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: post.user_id } })}
            accessibilityRole="link"
            hitSlop={8}>
            <Text variant="bodyStrong" style={onPhoto}>
              {isMine ? 'you' : displayName(post.username)}
            </Text>
          </Pressable>
          {!isMine ? (
            <Pressable onPress={() => onFollow(post)} accessibilityRole="button" hitSlop={10}>
              <Text style={[onPhoto, styles.link]}>{post.following ? 'following' : 'follow'}</Text>
            </Pressable>
          ) : null}
          <Text variant="caption" style={[onPhoto, styles.push]}>
            +{post.points} · {lateLabel(minutesBetween(challenge.opens_at, post.created_at))}
          </Text>
        </View>
        {post.caption ? (
          <Text style={onPhoto} numberOfLines={3}>
            {post.caption}
          </Text>
        ) : null}
        <View style={[styles.row, styles.reactionsRow]}>
          <View style={styles.faces}>
            {shown.map((r, i) => (
              <Image
                key={r.image_path}
                source={urls[r.image_path] ? { uri: urls[r.image_path] } : undefined}
                style={[styles.face, { borderColor: theme.onPhoto, backgroundColor: theme.surface, marginLeft: i ? -10 : 0 }]}
                contentFit="cover"
                accessibilityLabel={`reaction from ${displayName(r.username)}`}
              />
            ))}
            <Text variant="caption" style={[onPhoto, shown.length ? styles.facesText : null]}>
              {post.reaction_count === 0 ? 'no reactions yet' : more > 0 ? `+${more}` : ''}
            </Text>
          </View>
          {isMine ? (
            url ? (
              <Pressable onPress={() => sharePhoto(url, post.id).catch(() => {})} accessibilityRole="button" hitSlop={12}>
                <Text style={[onPhoto, styles.strong]}>share</Text>
              </Pressable>
            ) : null
          ) : (
            <View style={styles.row}>
              <Pressable onPress={() => onReact(post)} accessibilityRole="button" hitSlop={12}>
                <Text style={[onPhoto, styles.strong]}>{post.my_reaction ? 'react again' : 'react'}</Text>
              </Pressable>
              <Pressable onPress={() => onMore(post)} accessibilityRole="button" accessibilityLabel="more" hitSlop={12}>
                <Text style={onPhoto}>···</Text>
              </Pressable>
            </View>
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
  cta: { marginTop: space.lg, minWidth: 200 },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: layout.gutter,
    paddingBottom: space.md,
  },
  band: { position: 'absolute', left: space.md, right: space.md, borderRadius: radius.md, padding: space.md, gap: space.xs },
  challengeBand: { top: 72 },
  bottomBand: { bottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  push: { marginLeft: 'auto' },
  link: { fontFamily: fonts.bodySemiBold, textDecorationLine: 'underline' },
  strong: { fontFamily: fonts.bodySemiBold },
  reactionsRow: { justifyContent: 'space-between', marginTop: space.xs },
  faces: { flexDirection: 'row', alignItems: 'center' },
  face: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5 },
  facesText: { marginLeft: space.sm },
  // Over photos the normal button can vanish into the picture, so this one sits on the scrim.
  floating: {
    position: 'absolute',
    right: layout.gutter,
    bottom: 170,
    minHeight: 54,
    paddingHorizontal: space.xl,
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
