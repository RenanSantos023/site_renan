"""
Cloze deletion parser and text formatter for flashcards.
Supports:
- {{c1::answer}}
- {{c1::answer::hint}}
- Multiple cloze numbers in the same or different fields (c1, c2, c3...)
"""

import re
from typing import List, Set, Tuple


CLOZE_REGEX = re.compile(r"\{\{c(\d+)::(.*?)(?:::([^}]*))?\}\}")


def extract_cloze_numbers(text: str) -> List[int]:
    """
    Extracts sorted unique cloze indexes present in the text (e.g. [1, 2, 3]).
    """
    matches = CLOZE_REGEX.findall(text)
    numbers: Set[int] = {int(m[0]) for m in matches}
    return sorted(list(numbers)) if numbers else []


def render_cloze_card(text: str, target_cloze: int) -> Tuple[str, str]:
    """
    Renders (Front, Back) representation of text for a specific cloze ordinal.
    
    Front: Replaces {{c<target>::answer}} with [...] or [hint], while rendering other
           clozes {{c<other>::answer}} as their plain text answer.
    Back: Highlights the answer for target cloze while keeping other clozes plain.
    """
    def front_replacer(match: re.Match) -> str:
        c_num = int(match.group(1))
        hint = match.group(3)

        if c_num == target_cloze:
            if hint:
                return f"[{hint}]"
            return "[...]"
        return match.group(2)

    def back_replacer(match: re.Match) -> str:
        c_num = int(match.group(1))
        answer = match.group(2)
        if c_num == target_cloze:
            return f"**{answer}**"
        return answer

    front = CLOZE_REGEX.sub(front_replacer, text)
    back = CLOZE_REGEX.sub(back_replacer, text)
    return front, back
