// 0x578290 CellRecalc_B size=B2

int __thiscall sub_578290(_DWORD *this)
{
  int v1; // eax
  int v2; // ebp
  int v3; // edx
  int v5; // edx
  int v6; // eax
  int v7; // esi
  int v8; // esi
  int v9; // edx
  int v10; // eax

  v1 = *(this + 69);
  v2 = *(this + 70);
  if ( v1 != 0 )
  {
    v3 = *(this + 68) - 1;
    ++*(this + 67);
    *(this + 69) = v1 - 1;
    *(this + 68) = v3;
    *(this + 70) = v2 - 2044;
    return *(_DWORD *)v2;
  }
  else
  {
    v5 = *(this + 68);
    v6 = *(this + 67);
    v7 = *(this + 61);
    *(this + 67) = v5;
    *(this + 68) = v6;
    if ( (((_BYTE)v5 - (_BYTE)v7 + (_BYTE)v6 - 1) & 1) != 0 )
    {
      v8 = v7 - 1;
      *(this + 68) = v6 + 1;
    }
    else
    {
      v8 = v7 - 2;
      *(this + 67) = v5 + 1;
    }
    v9 = *(this + 67);
    v10 = *(this + 68) << 9;
    *(this + 69) = v8;
    *(this + 70) = *(this + 79) + 4 * (v9 + v10);
    return *(_DWORD *)v2;
  }
}
