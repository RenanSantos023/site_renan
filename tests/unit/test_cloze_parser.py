"""
Unit tests for Cloze Deletion Parser.
"""

from domain.cloze_parser import extract_cloze_numbers, render_cloze_card


def test_extract_cloze_numbers():
    text = "A {{c1::mitocôndria}} é responsável pela respiração {{c2::celular}} e {{c1::síntese de ATP}}."
    numbers = extract_cloze_numbers(text)
    assert numbers == [1, 2]


def test_extract_cloze_numbers_empty():
    text = "Texto sem omissões de palavras."
    assert extract_cloze_numbers(text) == []


def test_render_cloze_card_single():
    text = "Capital da França é {{c1::Paris}}."
    front, back = render_cloze_card(text, target_cloze=1)
    assert front == "Capital da França é [...]."
    assert back == "Capital da França é **Paris**."


def test_render_cloze_card_with_hint():
    text = "O planeta {{c1::Marte::Planeta Vermelho}} tem duas luas."
    front, back = render_cloze_card(text, target_cloze=1)
    assert front == "O planeta [Planeta Vermelho] tem duas luas."
    assert back == "O planeta **Marte** tem duas luas."


def test_render_cloze_card_multiple_ordinals():
    text = "{{c1::Python}} é uma linguagem e {{c2::DynamoDB}} é um banco NoSQL."
    # For c1:
    f1, b1 = render_cloze_card(text, target_cloze=1)
    assert f1 == "[...] é uma linguagem e DynamoDB é um banco NoSQL."
    assert b1 == "**Python** é uma linguagem e DynamoDB é um banco NoSQL."

    # For c2:
    f2, b2 = render_cloze_card(text, target_cloze=2)
    assert f2 == "Python é uma linguagem e [...] é um banco NoSQL."
    assert b2 == "Python é uma linguagem e **DynamoDB** é um banco NoSQL."
