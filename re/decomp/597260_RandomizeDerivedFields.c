// 0x597260 RandomizeDerivedFields size=11A

int __thiscall sub_597260(_DWORD *this, int a2)
{
  int v3; // eax
  int v4; // esi
  int result; // eax

  *(this + 19) = sub_65C7E0(dword_886B88, dword_82B0A8[a2], dword_82B0BC[a2]);
  *(this + 17) = sub_65C7E0(dword_886B88, dword_82B10C[a2], dword_82B120[a2]);
  *(this + 24) = sub_65C7E0(dword_886B88, dword_ABED40[a2], dword_82B0F8[a2]);
  *(this + 27) = sub_65C7E0(dword_886B88, dword_ABED18[a2], dword_82B0D0[a2]);
  *(this + 28) = sub_65C7E0(dword_886B88, dword_82B080[a2], dword_82B094[a2]);
  *(this + 21) = 20 * *(this + 16);
  *(this + 22) = sub_65C7E0(dword_886B88, 0, 100);
  v3 = *(_DWORD *)(dword_ABE260 + 4 * a2);
  v4 = *(_DWORD *)(dword_ABE27C + 4 * a2);
  if ( v3 >= 0 )
  {
    if ( v3 > 100 )
      v3 = 100;
  }
  else
  {
    v3 = 0;
  }
  if ( v4 >= 0 )
  {
    if ( v4 > 100 )
      v4 = 100;
  }
  else
  {
    v4 = 0;
  }
  if ( v3 > v4 )
    v3 = v4;
  *(this + 23) = sub_65C7E0(dword_886B88, v3, v4);
  result = sub_65C7E0(dword_886B88, 0, 0xFFFF);
  *(this + 29) = result;
  return result;
}
