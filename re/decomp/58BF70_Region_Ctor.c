// 0x58bf70 Region_Ctor size=F7

_DWORD *__thiscall sub_58BF70(_DWORD *this, int a2)
{
  int *v3; // eax
  bool v4; // al
  int v5; // ecx
  int v6; // eax

  *this = 0;
  *(this + 1) = 0;
  *(this + 2) = dword_ABED14;
  *(this + 3) = 0;
  *(this + 4) = *((char *)sub_5657A0(&stru_87F7E8, (__int16 *)&a2) + 283);
  v3 = (int *)sub_5657A0(&stru_87F7E8, (__int16 *)&a2);
  v4 = sub_4865D0(v3);
  v5 = a2;
  *((_BYTE *)this + 20) = v4;
  *(_DWORD *)((char *)this + 22) = v5;
  *((_BYTE *)this + 26) = 0;
  *((_BYTE *)this + 27) = 1;
  *(this + 7) = 0;
  *(this + 8) = 0;
  *((_BYTE *)this + 36) = 0;
  *(this + 11) = 0;
  *(this + 12) = 0;
  *((_BYTE *)this + 52) = 1;
  *((_BYTE *)this + 53) = 0;
  *(this + 10) = &DynamicVectorClass<Cell>::`vftable';
  *(this + 15) = 10;
  *(this + 14) = 0;
  *(this + 16) = 0;
  *(this + 17) = 0;
  *(this + 18) = 0;
  *(this + 19) = 0;
  *(this + 15) = 100000;
  ++dword_ABED14;
  if ( dword_ABDFA0 < dword_ABDF98
    || (byte_ABDF9D != 0 || dword_ABDF98 == 0)
    && dword_ABDFA4 > 0
    && (*(unsigned __int8 (__thiscall **)(int *, int, _DWORD))(dword_ABDF90 + 8))(
         &dword_ABDF90,
         dword_ABDF98 + dword_ABDFA4,
         0) != 0 )
  {
    v6 = dword_ABDFA0++;
    *((_DWORD *)dword_ABDF94 + v6) = this;
  }
  return this;
}
