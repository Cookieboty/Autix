import { presentPublicProfile, type PublicProfileUserSource } from './public-profile.presenter';

const BASE: PublicProfileUserSource = {
  id: 'u1',
  username: 'amy',
  nickname: 'Amy',
  realName: 'Amy Real',
  avatar: 'a.png',
  bannerImage: 'b.png',
  headline: 'Creator of things',
  description: 'hi there',
  location: 'NYC',
  socialX: 'x.com/amy',
  socialInstagram: null,
  socialYoutube: '  ',
  socialTiktok: null,
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
};

const STATS = { viewCount: 12, likeCount: 3, generationCount: 4 };

describe('presentPublicProfile', () => {
  it('displayName 走 nickname → realName → username 回退', () => {
    expect(presentPublicProfile(BASE, STATS).displayName).toBe('Amy');
    expect(presentPublicProfile({ ...BASE, nickname: null }, STATS).displayName).toBe('Amy Real');
    expect(
      presentPublicProfile({ ...BASE, nickname: null, realName: '  ' }, STATS).displayName,
    ).toBe('amy');
  });

  it('空串/纯空白字段归一为 null（socialYoutube="  " → null）', () => {
    const p = presentPublicProfile(BASE, STATS);
    expect(p.socials.youtube).toBeNull();
    expect(p.socials.instagram).toBeNull();
    expect(p.socials.x).toBe('x.com/amy');
  });

  it('透传 banner/bio/location/stats，joinedAt 转 ISO', () => {
    const p = presentPublicProfile(BASE, STATS);
    expect(p.bannerImage).toBe('b.png');
    expect(p.bio).toBe('hi there');
    expect(p.location).toBe('NYC');
    expect(p.stats).toEqual(STATS);
    expect(p.joinedAt).toBe('2026-01-02T03:04:05.000Z');
  });
});
