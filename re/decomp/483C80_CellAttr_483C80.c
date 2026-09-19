// 0x483c80 CellAttr_483C80 size=1A9

void __thiscall sub_483C80(_DWORD *this)
{
  int v2; // eax
  int v3; // ecx
  int v4; // eax
  _DWORD *v5; // esi
  int v6; // eax
  int v7; // eax
  int v8; // eax

  if ( (unsigned __int8)sub_578460(this + 9, 1) == 0 )
  {
    *(this + 19) = 7;
    return;
  }
  v2 = *(this + 17);
  if ( v2 != -1 )
  {
    v3 = *((_DWORD *)dword_A83D84 + v2);
    if ( *(_BYTE *)(v3 + 557) != 0 )
    {
      *(this + 19) = 1;
      return;
    }
    if ( *(_BYTE *)(v3 + 680) != 0 )
      goto LABEL_7;
    if ( flt_89EA48[9 * *(_DWORD *)(v3 + 664)] == 0.0 )
    {
      *(this + 19) = 6;
      return;
    }
    if ( *(_BYTE *)(v3 + 693) != 0 )
    {
      *(this + 19) = 6;
      return;
    }
    if ( *(_BYTE *)(v3 + 692) != 0 )
      goto LABEL_31;
  }
  v4 = *(this + 59);
  if ( v4 == 2 )
  {
    *(this + 19) = 4;
    return;
  }
  if ( v4 == 6 )
  {
    *(this + 19) = 3;
    return;
  }
  if ( flt_89EA48[9 * v4] <= 0.01 )
  {
LABEL_18:
    *(this + 19) = 6;
    return;
  }
  v5 = (_DWORD *)*(this + 57);
  if ( v5 == nullptr )
  {
LABEL_31:
    *(this + 19) = 0;
    return;
  }
  while ( 1 )
  {
    v6 = (*(int (__thiscall **)(_DWORD *))(*v5 + 44))(v5);
    if ( v6 == 6 )
    {
      v7 = v5[328];
      if ( *(_BYTE *)(v7 + 5824) != 0 )
      {
        if ( *(_BYTE *)(v5[135] + 506) != 0 )
          goto LABEL_18;
      }
      else if ( *(_BYTE *)(v7 + 5823) != 0 )
      {
        v8 = v5[390];
        if ( v8 != 12 && v8 != 8 )
          *(this + 19) = 6;
      }
      goto LABEL_30;
    }
    if ( v6 == 36 )
      break;
LABEL_30:
    v5 = (_DWORD *)v5[12];
    if ( v5 == nullptr )
      goto LABEL_31;
  }
  if ( *((_DWORD *)dword_A8B230 + 1174) == 1 )
  {
    if ( *(_DWORD *)(v5[50] + 684) == 7 )
      goto LABEL_7;
  }
  else if ( *(_DWORD *)(v5[50] + 680) == 7 )
  {
LABEL_7:
    *(this + 19) = 2;
    return;
  }
  *(this + 19) = 5;
}
