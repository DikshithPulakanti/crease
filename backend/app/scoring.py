"""
Scoring Engine — Approach 3: Position DNA + Out-of-Position Rarity Multiplier
------------------------------------------------------------------------------
Each position is judged on its own parameters.
Out-of-position actions get a rarity bonus.
Clean sheet uses Option B — snapshot at substitution minute.
Captain = 2x, Vice Captain = 1.5x applied to final points.
Win bonus = +1 for players whose real CL team won the match.
"""

from typing import Optional


def calculate_gk_points(stats: dict, sub_snapshot: Optional[dict] = None) -> dict:
    """
    GK scoring — Primary: Shot Stopping & Distribution
    """
    points = 0.0
    breakdown = {}

    # Minutes played
    minutes = stats.get("minutes", 0)
    if minutes >= 60:
        points += 2
        breakdown["minutes_60+"] = 2
    elif minutes >= 1:
        points += 1
        breakdown["minutes_1_59"] = 1

    # Saves
    saves = stats.get("saves", 0)
    if saves > 0:
        pts = saves * 2
        points += pts
        breakdown["saves"] = pts

    # Penalty save
    penalty_saves = stats.get("penalty_saves", 0)
    if penalty_saves > 0:
        pts = penalty_saves * 8
        points += pts
        breakdown["penalty_saves"] = pts

    # Clean sheet (Option B — uses sub_snapshot if subbed off)
    goals_conceded = _goals_conceded_at_time(stats, sub_snapshot)
    if goals_conceded == 0 and minutes >= 60:
        points += 6
        breakdown["clean_sheet"] = 6

    # High claim
    high_claims = stats.get("high_claims", 0)
    if high_claims > 0:
        pts = high_claims * 2
        points += pts
        breakdown["high_claims"] = pts

    # Sweeper keeper actions
    sweeper_actions = stats.get("sweeper_actions", 0)
    if sweeper_actions > 0:
        pts = sweeper_actions * 2
        points += pts
        breakdown["sweeper_actions"] = pts

    # Distribution accuracy 60%+
    if stats.get("pass_accuracy", 0) >= 60:
        points += 2
        breakdown["distribution"] = 2

    # Goals conceded penalty (per goal)
    if goals_conceded > 0:
        pts = goals_conceded * -2
        points += pts
        breakdown["goals_conceded"] = pts

    # Error leading to goal
    errors = stats.get("errors_leading_to_goal", 0)
    if errors > 0:
        pts = errors * -5
        points += pts
        breakdown["errors_leading_to_goal"] = pts

    # Cards
    if stats.get("yellow_card", False):
        points += -2
        breakdown["yellow_card"] = -2
    if stats.get("red_card", False):
        points += -6
        breakdown["red_card"] = -6

    # --- Out-of-Position Rarity Bonuses ---
    goals = stats.get("goals", 0)
    if goals > 0:
        pts = goals * 20  # GK scoring is extraordinarily rare
        points += pts
        breakdown["goals_rarity"] = pts

    assists = stats.get("assists", 0)
    if assists > 0:
        pts = assists * 12
        points += pts
        breakdown["assists_rarity"] = pts

    aerial_duels_won = stats.get("aerial_duels_won", 0)
    if aerial_duels_won > 0:
        pts = aerial_duels_won * 3
        points += pts
        breakdown["aerial_duels_rarity"] = pts

    return {"total": round(points, 1), "breakdown": breakdown}


def calculate_def_points(stats: dict, sub_snapshot: Optional[dict] = None) -> dict:
    """
    DEF scoring — Primary: Defending. Secondary: Build-up
    """
    points = 0.0
    breakdown = {}

    minutes = stats.get("minutes", 0)
    if minutes >= 60:
        points += 2
        breakdown["minutes_60+"] = 2
    elif minutes >= 1:
        points += 1
        breakdown["minutes_1_59"] = 1

    # Tackles won
    tackles = stats.get("tackles_won", 0)
    if tackles > 0:
        pts = tackles * 1.5
        points += pts
        breakdown["tackles_won"] = pts

    # Interceptions
    interceptions = stats.get("interceptions", 0)
    if interceptions > 0:
        pts = interceptions * 1.5
        points += pts
        breakdown["interceptions"] = pts

    # Clearances
    clearances = stats.get("clearances", 0)
    if clearances > 0:
        pts = clearances * 1.0
        points += pts
        breakdown["clearances"] = pts

    # Blocked shots
    blocked_shots = stats.get("blocked_shots", 0)
    if blocked_shots > 0:
        pts = blocked_shots * 2.0
        points += pts
        breakdown["blocked_shots"] = pts

    # Aerial duels won
    aerial_duels = stats.get("aerial_duels_won", 0)
    if aerial_duels > 0:
        pts = aerial_duels * 1.0
        points += pts
        breakdown["aerial_duels_won"] = pts

    # Clean sheet
    goals_conceded = _goals_conceded_at_time(stats, sub_snapshot)
    if goals_conceded == 0 and minutes >= 60:
        points += 5
        breakdown["clean_sheet"] = 5

    # Progressive carries
    prog_carries = stats.get("progressive_carries", 0)
    if prog_carries > 0:
        pts = prog_carries * 1.0
        points += pts
        breakdown["progressive_carries"] = pts

    # Accurate long balls
    long_balls = stats.get("accurate_long_balls", 0)
    if long_balls > 0:
        pts = long_balls * 0.5
        points += pts
        breakdown["accurate_long_balls"] = pts

    # Goals conceded penalty
    if goals_conceded > 0:
        pts = goals_conceded * -1.5
        points += pts
        breakdown["goals_conceded"] = pts

    # Dribbled past
    dribbled_past = stats.get("dribbled_past", 0)
    if dribbled_past > 0:
        pts = dribbled_past * -1.5
        points += pts
        breakdown["dribbled_past"] = pts

    # Error leading to goal
    errors = stats.get("errors_leading_to_goal", 0)
    if errors > 0:
        pts = errors * -5
        points += pts
        breakdown["errors_leading_to_goal"] = pts

    # Cards
    if stats.get("yellow_card", False):
        points += -2
        breakdown["yellow_card"] = -2
    if stats.get("red_card", False):
        points += -6
        breakdown["red_card"] = -6

    # --- Out-of-Position Rarity Bonuses ---
    goals = stats.get("goals", 0)
    if goals > 0:
        pts = goals * 7
        points += pts
        breakdown["goals"] = pts

    assists = stats.get("assists", 0)
    if assists > 0:
        pts = assists * 5
        points += pts
        breakdown["assists"] = pts

    # Dribble in final third
    final_third_dribbles = stats.get("final_third_dribbles", 0)
    if final_third_dribbles > 0:
        pts = final_third_dribbles * 3
        points += pts
        breakdown["final_third_dribbles_rarity"] = pts

    # Shot on target (rare for DEF)
    shots_on_target = stats.get("shots_on_target", 0)
    if shots_on_target > 0:
        pts = shots_on_target * 2
        points += pts
        breakdown["shots_on_target_rarity"] = pts

    return {"total": round(points, 1), "breakdown": breakdown}


def calculate_mid_points(stats: dict, sub_snapshot: Optional[dict] = None) -> dict:
    """
    MID scoring — Primary: Control & Transition. Secondary: Everything.
    """
    points = 0.0
    breakdown = {}

    minutes = stats.get("minutes", 0)
    if minutes >= 60:
        points += 2
        breakdown["minutes_60+"] = 2
    elif minutes >= 1:
        points += 1
        breakdown["minutes_1_59"] = 1

    # Goals
    goals = stats.get("goals", 0)
    if goals > 0:
        pts = goals * 5
        points += pts
        breakdown["goals"] = pts

    # Assists
    assists = stats.get("assists", 0)
    if assists > 0:
        pts = assists * 5
        points += pts
        breakdown["assists"] = pts

    # Key passes
    key_passes = stats.get("key_passes", 0)
    if key_passes > 0:
        pts = key_passes * 2.5
        points += pts
        breakdown["key_passes"] = pts

    # Chances created
    chances_created = stats.get("chances_created", 0)
    if chances_created > 0:
        pts = chances_created * 2.0
        points += pts
        breakdown["chances_created"] = pts

    # Progressive passes
    prog_passes = stats.get("progressive_passes", 0)
    if prog_passes > 0:
        pts = prog_passes * 0.5
        points += pts
        breakdown["progressive_passes"] = pts

    # Tackles won
    tackles = stats.get("tackles_won", 0)
    if tackles > 0:
        pts = tackles * 1.0
        points += pts
        breakdown["tackles_won"] = pts

    # Interceptions
    interceptions = stats.get("interceptions", 0)
    if interceptions > 0:
        pts = interceptions * 1.0
        points += pts
        breakdown["interceptions"] = pts

    # Ball recoveries
    recoveries = stats.get("ball_recoveries", 0)
    if recoveries > 0:
        pts = recoveries * 0.5
        points += pts
        breakdown["ball_recoveries"] = pts

    # Dribbles completed
    dribbles = stats.get("dribbles_completed", 0)
    if dribbles > 0:
        pts = dribbles * 1.0
        points += pts
        breakdown["dribbles_completed"] = pts

    # Clean sheet bonus (small for MID)
    goals_conceded = _goals_conceded_at_time(stats, sub_snapshot)
    if goals_conceded == 0 and minutes >= 60:
        points += 1
        breakdown["clean_sheet"] = 1

    # Possession lost penalty (every 5)
    possession_lost = stats.get("possession_lost", 0)
    if possession_lost >= 5:
        pts = -(possession_lost // 5)
        points += pts
        breakdown["possession_lost"] = pts

    # Cards
    if stats.get("yellow_card", False):
        points += -2
        breakdown["yellow_card"] = -2
    if stats.get("red_card", False):
        points += -6
        breakdown["red_card"] = -6

    # --- Out-of-Position Rarity Bonuses ---
    # Goal from outside the box
    outside_box_goals = stats.get("outside_box_goals", 0)
    if outside_box_goals > 0:
        pts = outside_box_goals * 4
        points += pts
        breakdown["outside_box_goals_rarity"] = pts

    # Aerial duel won in own box
    own_box_aerials = stats.get("own_box_aerial_duels_won", 0)
    if own_box_aerials > 0:
        pts = own_box_aerials * 2
        points += pts
        breakdown["own_box_aerials_rarity"] = pts

    return {"total": round(points, 1), "breakdown": breakdown}


def calculate_att_points(stats: dict, sub_snapshot: Optional[dict] = None) -> dict:
    """
    ATT scoring — Primary: Creating & Converting Chances
    """
    points = 0.0
    breakdown = {}

    minutes = stats.get("minutes", 0)
    if minutes >= 60:
        points += 2
        breakdown["minutes_60+"] = 2
    elif minutes >= 1:
        points += 1
        breakdown["minutes_1_59"] = 1

    # Goals
    goals = stats.get("goals", 0)
    if goals > 0:
        pts = goals * 5
        points += pts
        breakdown["goals"] = pts

    # Assists
    assists = stats.get("assists", 0)
    if assists > 0:
        pts = assists * 4
        points += pts
        breakdown["assists"] = pts

    # Shots on target
    shots_on_target = stats.get("shots_on_target", 0)
    if shots_on_target > 0:
        pts = shots_on_target * 1.5
        points += pts
        breakdown["shots_on_target"] = pts

    # Shots off target penalty
    shots_off = stats.get("shots_off_target", 0)
    if shots_off > 0:
        pts = shots_off * -0.5
        points += pts
        breakdown["shots_off_target"] = pts

    # Big chance missed
    big_chance_missed = stats.get("big_chance_missed", 0)
    if big_chance_missed > 0:
        pts = big_chance_missed * -3
        points += pts
        breakdown["big_chance_missed"] = pts

    # Dribbles completed
    dribbles = stats.get("dribbles_completed", 0)
    if dribbles > 0:
        pts = dribbles * 2.0
        points += pts
        breakdown["dribbles_completed"] = pts

    # Chances created
    chances_created = stats.get("chances_created", 0)
    if chances_created > 0:
        pts = chances_created * 2.0
        points += pts
        breakdown["chances_created"] = pts

    # Offsides penalty
    offsides = stats.get("offsides", 0)
    if offsides > 0:
        pts = offsides * -0.5
        points += pts
        breakdown["offsides"] = pts

    # Cards
    if stats.get("yellow_card", False):
        points += -2
        breakdown["yellow_card"] = -2
    if stats.get("red_card", False):
        points += -6
        breakdown["red_card"] = -6

    # --- Out-of-Position Rarity Bonuses ---
    # Aerial duel won in own half (ATT tracking back)
    defensive_aerials = stats.get("defensive_aerial_duels_won", 0)
    if defensive_aerials > 0:
        pts = defensive_aerials * 4
        points += pts
        breakdown["defensive_aerials_rarity"] = pts

    # Tackle won in own half
    own_half_tackles = stats.get("own_half_tackles_won", 0)
    if own_half_tackles > 0:
        pts = own_half_tackles * 3
        points += pts
        breakdown["own_half_tackles_rarity"] = pts

    # Clearance in own box
    own_box_clearances = stats.get("own_box_clearances", 0)
    if own_box_clearances > 0:
        pts = own_box_clearances * 4
        points += pts
        breakdown["own_box_clearances_rarity"] = pts

    # Interception in defensive third
    defensive_interceptions = stats.get("defensive_third_interceptions", 0)
    if defensive_interceptions > 0:
        pts = defensive_interceptions * 3
        points += pts
        breakdown["defensive_interceptions_rarity"] = pts

    return {"total": round(points, 1), "breakdown": breakdown}


def calculate_universal_bonuses(stats: dict, base_points: float) -> dict:
    """
    Universal bonuses applied on top of position-specific points.
    """
    bonus = 0.0
    breakdown = {}

    # Man of the Match
    if stats.get("motm", False):
        bonus += 6
        breakdown["motm"] = 6

    goals = stats.get("goals", 0)

    # Hat trick
    if goals >= 3:
        bonus += 10
        breakdown["hat_trick"] = 10
    # Brace
    elif goals == 2:
        bonus += 3
        breakdown["brace"] = 3

    # Goal + Assist same game
    if goals >= 1 and stats.get("assists", 0) >= 1:
        bonus += 3
        breakdown["goal_and_assist"] = 3

    # Own goal
    own_goals = stats.get("own_goals", 0)
    if own_goals > 0:
        pts = own_goals * -4
        bonus += pts
        breakdown["own_goals"] = pts

    # Penalty missed
    penalties_missed = stats.get("penalties_missed", 0)
    if penalties_missed > 0:
        pts = penalties_missed * -3
        bonus += pts
        breakdown["penalties_missed"] = pts

    return {"bonus": round(bonus, 1), "breakdown": breakdown}


def apply_captain_multiplier(points: float, is_captain: bool, is_vice_captain: bool) -> float:
    """
    Captain = 2x, Vice Captain = 1.5x
    """
    if is_captain:
        return round(points * 2, 1)
    elif is_vice_captain:
        return round(points * 1.5, 1)
    return points


def apply_win_bonus(points: float, team_won: bool) -> float:
    """
    +1 if player's real CL team won the match.
    """
    if team_won:
        return round(points + 1, 1)
    return points


def calculate_player_points(
    position: str,
    stats: dict,
    sub_snapshot: Optional[dict] = None,
    is_captain: bool = False,
    is_vice_captain: bool = False,
    team_won: bool = False,
) -> dict:
    """
    Main entry point. Calculates full fantasy points for a player.

    Args:
        position: GK / DEF / MID / ATT
        stats: dict of match stats from API-Football
        sub_snapshot: {minute, home_score, away_score} at substitution
        is_captain: whether this player is the team's captain
        is_vice_captain: whether this player is the team's vice captain
        team_won: whether the player's real club won the match

    Returns:
        {
            base_points: float,
            bonus_points: float,
            total_points: float,
            breakdown: dict
        }
    """
    # Calculate position-specific points
    if position == "GK":
        pos_result = calculate_gk_points(stats, sub_snapshot)
    elif position == "DEF":
        pos_result = calculate_def_points(stats, sub_snapshot)
    elif position == "MID":
        pos_result = calculate_mid_points(stats, sub_snapshot)
    elif position == "ATT":
        pos_result = calculate_att_points(stats, sub_snapshot)
    else:
        pos_result = {"total": 0.0, "breakdown": {}}

    base_points = pos_result["total"]
    base_breakdown = pos_result["breakdown"]

    # Calculate universal bonuses
    bonus_result = calculate_universal_bonuses(stats, base_points)
    bonus_points = bonus_result["bonus"]
    bonus_breakdown = bonus_result["breakdown"]

    # Combine
    total = base_points + bonus_points

    # Apply win bonus
    total = apply_win_bonus(total, team_won)
    if team_won:
        bonus_breakdown["win_bonus"] = 1

    # Apply captain/VC multiplier
    total = apply_captain_multiplier(total, is_captain, is_vice_captain)

    return {
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total,
        "breakdown": {**base_breakdown, **bonus_breakdown},
    }


def _goals_conceded_at_time(stats: dict, sub_snapshot: Optional[dict]) -> int:
    """
    Option B: If player was subbed off, use goals conceded at that minute.
    Otherwise use final goals conceded.
    """
    if sub_snapshot and sub_snapshot.get("minute"):
        # Use the score at the time of substitution
        return sub_snapshot.get("goals_conceded_at_sub", 0)
    return stats.get("goals_conceded", 0)