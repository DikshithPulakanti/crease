"""
Crease fantasy scoring — position-specific standards, universal match points,
out-of-position rarity bonuses, then win/draw, then captain multipliers on final total.
"""

from __future__ import annotations

from typing import Any, Optional


def _r(x: Any, default: float = 0.0) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def _i(x: Any, default: int = 0) -> int:
    try:
        return int(x)
    except (TypeError, ValueError):
        return default


def score_minutes_universal(stats: dict) -> tuple[float, dict]:
    """90+ min: +2 | 60–89 min: +1 (General — all positions)."""
    minutes = _i(stats.get("minutes", 0))
    bd: dict = {}
    if minutes >= 90:
        return 2.0, {"minutes_90_plus": 2}
    if minutes >= 60:
        return 1.0, {"minutes_60_89": 1}
    return 0.0, bd


def _goals_conceded_at_time(stats: dict, sub_snapshot: Optional[dict]) -> int:
    if sub_snapshot and sub_snapshot.get("minute"):
        return _i(sub_snapshot.get("goals_conceded_at_sub", stats.get("goals_conceded", 0)))
    return _i(stats.get("goals_conceded", 0))


def calculate_gk_standard(stats: dict, sub_snapshot: Optional[dict] = None) -> tuple[float, dict]:
    """Goalkeeping — standard events only."""
    points = 0.0
    bd: dict = {}
    minutes = _i(stats.get("minutes", 0))

    saves = _i(stats.get("saves", 0))
    saves_inside = _i(stats.get("saves_inside_box", 0))
    saves_out = max(0, saves - saves_inside)
    if saves_out:
        p = saves_out * 2
        points += p
        bd["saves"] = p
    if saves_inside:
        p = saves_inside * 3
        points += p
        bd["saves_inside_box"] = p

    ps = _i(stats.get("penalty_saves", 0))
    if ps:
        p = ps * 8
        points += p
        bd["penalty_saves"] = p

    gc = _goals_conceded_at_time(stats, sub_snapshot)
    if gc == 0 and minutes >= 60:
        points += 6
        bd["clean_sheet_60"] = 6

    xg_faced = _r(stats.get("xg_faced", stats.get("expected_goals_against", 0)))
    prevention = max(0.0, xg_faced - float(gc))
    if prevention > 0:
        units = prevention / 0.5
        p = round(units * 2.0, 1)
        points += p
        bd["goals_prevented_xg"] = p

    hc = _i(stats.get("high_claims", 0))
    if hc:
        p = hc * 2
        points += p
        bd["high_claims"] = p

    sw = _i(stats.get("sweeper_actions", 0))
    if sw:
        p = sw * 2
        points += p
        bd["sweeper_keeper"] = p

    if _r(stats.get("pass_accuracy", stats.get("passes_accuracy", 0))) >= 60.0:
        points += 2
        bd["long_distribution_60pct"] = 2

    if gc > 0:
        p = gc * -2
        points += p
        bd["goals_conceded"] = p

    err = _i(stats.get("errors_leading_to_goal", 0))
    if err:
        p = err * -5
        points += p
        bd["errors_leading_to_goal"] = p

    return round(points, 1), bd


def calculate_gk_rarity(stats: dict) -> tuple[float, dict]:
    """GK out-of-position rarity bonuses."""
    points = 0.0
    bd: dict = {}
    g = _i(stats.get("goals", 0))
    if g:
        p = g * 20
        points += p
        bd["rarity_goal"] = p
    a = _i(stats.get("assists", 0))
    if a:
        p = a * 12
        points += p
        bd["rarity_assist"] = p
    aerial = _i(stats.get("aerial_open_play_duels_won", stats.get("aerial_duels_won_open_play", 0)))
    if aerial:
        p = aerial * 3
        points += p
        bd["rarity_aerial_open_play"] = p
    return round(points, 1), bd


def calculate_def_standard(stats: dict, sub_snapshot: Optional[dict] = None) -> tuple[float, dict]:
    points = 0.0
    bd: dict = {}
    minutes = _i(stats.get("minutes", 0))

    tw = _i(stats.get("tackles_won", 0))
    if tw:
        p = tw * 2
        points += p
        bd["tackles_won"] = p

    inter = _i(stats.get("interceptions", 0))
    if inter:
        p = inter * 2
        points += p
        bd["interceptions"] = p

    clr = _i(stats.get("clearances", 0))
    if clr:
        p = clr * 1
        points += p
        bd["clearances"] = p

    blk = _i(stats.get("blocked_shots", 0))
    if blk:
        p = blk * 3
        points += p
        bd["blocked_shots"] = p

    ad = _i(stats.get("aerial_duels_won", 0))
    if ad:
        p = ad * 1.5
        points += p
        bd["aerial_duels_won"] = p

    gd = _i(stats.get("ground_duels_won", 0))
    if gd:
        p = gd * 1
        points += p
        bd["ground_duels_won"] = p

    gc = _goals_conceded_at_time(stats, sub_snapshot)
    if gc == 0 and minutes >= 60:
        points += 5
        bd["clean_sheet_60"] = 5

    pc = _i(stats.get("progressive_carries", 0))
    if pc:
        p = pc * 1
        points += p
        bd["progressive_carry"] = p

    lb = _i(stats.get("accurate_long_balls", 0))
    if lb:
        p = lb * 0.5
        points += p
        bd["accurate_long_ball"] = p

    if gc > 0:
        p = gc * -1.5
        points += p
        bd["goals_conceded"] = p

    dp = _i(stats.get("dribbled_past", 0))
    if dp:
        p = dp * -1.5
        points += p
        bd["dribbled_past"] = p

    err = _i(stats.get("errors_leading_to_goal", 0))
    if err:
        p = err * -5
        points += p
        bd["errors_leading_to_goal"] = p

    return round(points, 1), bd


def calculate_def_rarity(stats: dict) -> tuple[float, dict]:
    points = 0.0
    bd: dict = {}
    g = _i(stats.get("goals", 0))
    if g:
        p = g * 10
        points += p
        bd["rarity_goal"] = p
    a = _i(stats.get("assists", 0))
    if a:
        p = a * 8
        points += p
        bd["rarity_assist"] = p
    ftd = _i(stats.get("final_third_dribbles", 0))
    if ftd:
        p = ftd * 3
        points += p
        bd["rarity_dribble_final_third"] = p
    sot = _i(stats.get("shots_on_target", 0))
    if sot:
        p = sot * 2
        points += p
        bd["rarity_shot_on_target"] = p
    return round(points, 1), bd


def calculate_mid_standard(stats: dict, sub_snapshot: Optional[dict] = None) -> tuple[float, dict]:
    points = 0.0
    bd: dict = {}

    g = _i(stats.get("goals", 0))
    if g:
        p = g * 6
        points += p
        bd["goals"] = p

    a = _i(stats.get("assists", 0))
    if a:
        p = a * 5
        points += p
        bd["assists"] = p

    kp = _i(stats.get("key_passes", 0))
    if kp:
        p = kp * 2.5
        points += p
        bd["key_passes"] = p

    cc = _i(stats.get("chances_created", stats.get("chances_created", 0)))
    if cc:
        p = cc * 2
        points += p
        bd["chances_created"] = p

    xa = _r(stats.get("xa", stats.get("expected_assists", 0)))
    if xa > 0:
        p = round((xa / 0.3) * 1.0, 1)
        points += p
        bd["xa_per_0_3"] = p

    pp = _i(stats.get("progressive_passes", 0))
    if pp:
        p = pp * 0.5
        points += p
        bd["progressive_pass"] = p

    dr = _i(stats.get("dribbles_completed", 0))
    if dr:
        p = dr * 1.5
        points += p
        bd["dribbles_completed"] = p

    rec = _i(stats.get("ball_recoveries", 0))
    if rec:
        p = rec * 1
        points += p
        bd["recoveries"] = p

    tw = _i(stats.get("tackles_won", 0))
    if tw:
        p = tw * 1.5
        points += p
        bd["tackles_won"] = p

    inter = _i(stats.get("interceptions", 0))
    if inter:
        p = inter * 1.5
        points += p
        bd["interceptions"] = p

    tat = _i(stats.get("tackles_attacking_third", 0))
    if tat:
        p = tat * 1
        points += p
        bd["tackle_attacking_third"] = p

    pl = _i(stats.get("possession_lost", 0))
    if pl >= 5:
        p = -(pl // 5)
        points += p
        bd["possession_lost"] = p

    return round(points, 1), bd


def calculate_mid_rarity(stats: dict, sub_snapshot: Optional[dict] = None) -> tuple[float, dict]:
    points = 0.0
    bd: dict = {}
    obg = _i(stats.get("outside_box_goals", 0))
    if obg:
        p = obg * 4
        points += p
        bd["rarity_goal_outside_box"] = p
    oba = _i(stats.get("own_box_aerial_duels_won", 0))
    if oba:
        p = oba * 2
        points += p
        bd["rarity_aerial_own_box"] = p
    minutes = _i(stats.get("minutes", 0))
    gc = _goals_conceded_at_time(stats, sub_snapshot)
    if gc == 0 and minutes >= 60:
        points += 2
        bd["rarity_clean_sheet_mid"] = 2
    return round(points, 1), bd


def calculate_att_standard(stats: dict) -> tuple[float, dict]:
    points = 0.0
    bd: dict = {}

    g = _i(stats.get("goals", 0))
    if g:
        p = g * 7
        points += p
        bd["goals"] = p

    a = _i(stats.get("assists", 0))
    if a:
        p = a * 5
        points += p
        bd["assists"] = p

    sot = _i(stats.get("shots_on_target", 0))
    if sot:
        p = sot * 1.5
        points += p
        bd["shots_on_target"] = p

    xg = _r(stats.get("xg", stats.get("expected_goals", 0)))
    if xg > 0:
        p = round((xg / 0.3) * 1.0, 1)
        points += p
        bd["xg_per_0_3"] = p

    dr = _i(stats.get("dribbles_completed", 0))
    if dr:
        p = dr * 2
        points += p
        bd["dribbles_completed"] = p

    bcc = _i(stats.get("big_chances_created", stats.get("chances_created", 0)))
    if bcc:
        p = bcc * 3
        points += p
        bd["big_chance_created"] = p

    tat = _i(stats.get("tackles_attacking_third", 0))
    if tat:
        p = tat * 1
        points += p
        bd["tackle_attacking_third"] = p

    soff = _i(stats.get("shots_off_target", 0))
    if soff:
        p = soff * -0.5
        points += p
        bd["shots_off_target"] = p

    bcm = _i(stats.get("big_chance_missed", 0))
    if bcm:
        p = bcm * -3
        points += p
        bd["big_chance_missed"] = p

    off = _i(stats.get("offsides", 0))
    if off:
        p = off * -0.5
        points += p
        bd["offsides"] = p

    return round(points, 1), bd


def calculate_att_rarity(stats: dict) -> tuple[float, dict]:
    points = 0.0
    bd: dict = {}
    da = _i(stats.get("defensive_aerial_duels_won", 0))
    if da:
        p = da * 4
        points += p
        bd["rarity_aerial_defensive"] = p
    oht = _i(stats.get("own_half_tackles_won", 0))
    if oht:
        p = oht * 3
        points += p
        bd["rarity_tackle_own_half"] = p
    obc = _i(stats.get("own_box_clearances", 0))
    if obc:
        p = obc * 4
        points += p
        bd["rarity_clearance_own_box"] = p
    dti = _i(stats.get("defensive_third_interceptions", 0))
    if dti:
        p = dti * 3
        points += p
        bd["rarity_interception_def_third"] = p
    return round(points, 1), bd


def calculate_universal_extras(stats: dict) -> tuple[float, dict]:
    """
    General tab — Match Points (all positions): MOTM, hat-trick, brace, G+A,
    own goal, penalty missed, yellow, red. Cards counted once here.
    """
    points = 0.0
    bd: dict = {}

    if stats.get("motm", False):
        points += 6
        bd["motm"] = 6

    goals = _i(stats.get("goals", 0))
    assists = _i(stats.get("assists", 0))

    if goals >= 3:
        points += 10
        bd["hat_trick_bonus"] = 10
    elif goals == 2:
        points += 4
        bd["brace_bonus"] = 4

    if goals >= 1 and assists >= 1:
        points += 4
        bd["goal_and_assist_bonus"] = 4

    og = _i(stats.get("own_goals", 0))
    if og:
        p = og * -4
        points += p
        bd["own_goals"] = p

    pm = _i(stats.get("penalties_missed", 0))
    if pm:
        p = pm * -3
        points += p
        bd["penalties_missed"] = p

    if stats.get("yellow_card", False):
        points += -2
        bd["yellow_card"] = -2
    if stats.get("red_card", False):
        points += -6
        bd["red_card"] = -6

    return round(points, 1), bd


def calculate_player_points(
    position: str,
    stats: dict,
    sub_snapshot: Optional[dict] = None,
    team_won: bool = False,
    match_draw: bool = False,
) -> dict:
    """
    Full fantasy points before lineup multipliers: minutes + position (standard + rarity for that
    role) + universal extras + match win (+1) / draw (+0.5). Captain / vice are applied in the router
    when summing the starting XI.
    """
    min_pts, min_bd = score_minutes_universal(stats)

    pos_pts = 0.0
    pos_bd: dict = {}
    if position == "GK":
        s, b = calculate_gk_standard(stats, sub_snapshot)
        r, br = calculate_gk_rarity(stats)
        pos_pts = s + r
        pos_bd = {**b, **br}
    elif position == "DEF":
        s, b = calculate_def_standard(stats, sub_snapshot)
        r, br = calculate_def_rarity(stats)
        pos_pts = s + r
        pos_bd = {**b, **br}
    elif position == "MID":
        s, b = calculate_mid_standard(stats, sub_snapshot)
        r, br = calculate_mid_rarity(stats, sub_snapshot)
        pos_pts = s + r
        pos_bd = {**b, **br}
    elif position == "ATT":
        s, b = calculate_att_standard(stats)
        r, br = calculate_att_rarity(stats)
        pos_pts = s + r
        pos_bd = {**b, **br}

    uni_pts, uni_bd = calculate_universal_extras(stats)

    match_pts = 0.0
    match_bd: dict = {}
    if team_won:
        match_pts += 1.0
        match_bd["match_winning_team"] = 1.0
    if match_draw:
        match_pts += 0.5
        match_bd["draw"] = 0.5

    # Captain / vice multipliers are applied when aggregating the starting XI (see scoring router).
    pre_captain = round(min_pts + pos_pts + uni_pts + match_pts, 1)

    base_points = round(min_pts + pos_pts, 1)
    bonus_points = round(uni_pts + match_pts, 1)

    all_bd = {
        **min_bd,
        **pos_bd,
        **uni_bd,
        **match_bd,
        "subtotal_before_lineup_multipliers": pre_captain,
    }

    return {
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": pre_captain,
        "breakdown": all_bd,
    }
