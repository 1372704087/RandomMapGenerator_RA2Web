// 0x595680 MapSeed_Ctor size=8C

char *__thiscall sub_595680(char *this)
{
  const wchar_t *v2; // eax

  sub_558740();
  *((_DWORD *)this + 14) = 0;
  *((_DWORD *)this + 15) = 1;
  *((_DWORD *)this + 16) = 1;
  *((_DWORD *)this + 17) = 0;
  *((_DWORD *)this + 18) = 1;
  *((_DWORD *)this + 19) = 0;
  *((_DWORD *)this + 20) = 2;
  *((_DWORD *)this + 21) = 0;
  *((_DWORD *)this + 22) = 0;
  *((_DWORD *)this + 23) = 0;
  *((_DWORD *)this + 24) = 0;
  *((_DWORD *)this + 25) = 0;
  *((_DWORD *)this + 26) = 0;
  *((_DWORD *)this + 27) = 0;
  *((_DWORD *)this + 28) = 0;
  *((_DWORD *)this + 29) = -1;
  *(_DWORD *)this = &MapSeedClass::`vftable';
  *((_DWORD *)this + 2) = &off_82BA60;
  *((_WORD *)this + 60) = 0;
  *((_DWORD *)this + 3) = this + 120;
  if ( sub_734FD0() != 0 )
  {
    v2 = (const wchar_t *)sub_734E60(aTxtRandomMapDe, (int)aDRa2mdpostMapg, 3934);
    wcscpy((wchar_t *)this + 60, v2);
  }
  return this;
}
