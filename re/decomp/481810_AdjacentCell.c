// 0x481810 AdjacentCell size=56

_DWORD *__thiscall sub_481810(_DWORD *this, unsigned int a2)
{
  _DWORD *result; // eax
  __int16 v3; // ax
  int v4; // [esp+0h] [ebp-4h]

  result = this;
  if ( a2 < 8 )
  {
    v4 = *(this + 9);
    v3 = HIWORD(v4) + HIWORD(dword_89F688[a2 & 7]);
    LOWORD(a2) = v4 + LOWORD(dword_89F688[a2 & 7]);
    HIWORD(a2) = v3;
    return (_DWORD *)sub_5657A0(&a2);
  }
  return result;
}
