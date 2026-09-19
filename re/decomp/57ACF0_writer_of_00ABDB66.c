bool __fastcall sub_57ACF0(int a1, int a2, _DWORD *a3, int a4, int a5, char a6)
{
  unsigned int v6; // eax
  int v7; // edi
  signed int v8; // ebp
  int v9; // eax
  char v10; // bl
  int v11; // ebp
  int v12; // eax
  _DWORD *v13; // esi
  _DWORD *v14; // edi
  char v15; // al
  _DWORD *v16; // esi
  _DWORD *v17; // edi
  char v18; // al
  _DWORD *v19; // esi
  _DWORD *v20; // edi
  char v21; // al
  _DWORD *v22; // esi
  _DWORD *v23; // edi
  char v24; // al
  _DWORD *v25; // esi
  int v26; // ecx
  __int16 v27; // dx
  __int16 v28; // ax
  bool v30; // [esp+13h] [ebp-Dh]
  bool v31; // [esp+13h] [ebp-Dh]
  bool v32; // [esp+13h] [ebp-Dh]
  bool v33; // [esp+13h] [ebp-Dh]
  bool v34; // [esp+13h] [ebp-Dh]
  bool v35; // [esp+13h] [ebp-Dh]
  bool v36; // [esp+13h] [ebp-Dh]
  bool v37; // [esp+13h] [ebp-Dh]
  _DWORD v38[2]; // [esp+14h] [ebp-Ch] BYREF
  char v39[4]; // [esp+1Ch] [ebp-4h] BYREF

  v38[1] = a1;
  v6 = sub_598030(0, 5u);
  v7 = a4;
  v8 = v6;
  if ( a4 == 2 )
    v9 = sub_57B210(a3, 1);
  else
    v9 = sub_57B210(a3, 0);
  v10 = v9;
  if ( v9 == 0 )
    return true;
  if ( v7 != 2 )
  {
    if ( (v9 & 2) != 0 )
    {
      v38[0] = 1;
      v13 = sub_481810(a3, 4u);
      v14 = sub_481810(v13, 2u);
      v30 = (unsigned __int8)sub_485060(v13) == 0;
      v15 = sub_485060(v14);
      if ( v30 )
      {
        do
        {
          if ( v15 == 0 )
            break;
          ++v38[0];
          v13 = sub_481810(v13, 4u);
          v14 = sub_481810(v14, 4u);
          v31 = (unsigned __int8)sub_485060(v13) == 0;
          v15 = sub_485060(v14);
        }
        while ( v31 );
      }
      if ( (v38[0] & 1) != 0 && v10 >= 0 || (v10 & 4) == 0 || (v10 & 0x18) != 0 )
      {
        v12 = 12;
        goto LABEL_71;
      }
      v12 = abs32(v8 % 3) + 9;
    }
    else if ( (v9 & 0x20) != 0 )
    {
      v38[0] = 1;
      v16 = sub_481810(a3, 4u);
      v17 = sub_481810(v16, 6u);
      v32 = (unsigned __int8)sub_485060(v16) == 0;
      v18 = sub_485060(v17);
      if ( v32 )
      {
        do
        {
          if ( v18 == 0 )
            break;
          ++v38[0];
          v16 = sub_481810(v16, 4u);
          v17 = sub_481810(v17, 4u);
          v33 = (unsigned __int8)sub_485060(v16) == 0;
          v18 = sub_485060(v17);
        }
        while ( v33 );
      }
      if ( (v38[0] & 1) != 0 && v10 >= 0 || (v10 & 0x10) == 0 || (v10 & 0xC) != 0 )
      {
        v12 = 28;
        goto LABEL_71;
      }
      v12 = v8 % 3 + 25;
    }
    else if ( (v9 & 8) != 0 )
    {
      v38[0] = 1;
      v19 = sub_481810(a3, 2u);
      v20 = sub_481810(v19, 4u);
      v34 = (unsigned __int8)sub_485060(v19) == 0;
      v21 = sub_485060(v20);
      if ( v34 )
      {
        do
        {
          if ( v21 == 0 )
            break;
          ++v38[0];
          v19 = sub_481810(v19, 2u);
          v20 = sub_481810(v20, 2u);
          v35 = (unsigned __int8)sub_485060(v19) == 0;
          v21 = sub_485060(v20);
        }
        while ( v35 );
      }
      if ( (v38[0] & 1) != 0 || (v10 & 4) == 0 || (v10 & 3) != 0 )
      {
        v12 = 4;
        goto LABEL_71;
      }
      v12 = v8 % 3 + 1;
    }
    else
    {
      if ( (v9 & 0x80u) == 0 )
      {
LABEL_61:
        if ( (v10 & 1) != 0 )
        {
          v11 = (v8 & 1) + 35;
        }
        else if ( (v10 & 4) != 0 )
        {
          v11 = (v8 & 1) + 33;
        }
        else if ( (v10 & 0x10) != 0 )
        {
          v11 = (v8 & 1) + 39;
        }
        else
        {
          if ( (v10 & 0x40) == 0 )
            return true;
          v11 = (v8 & 1) + 37;
        }
        goto LABEL_69;
      }
      v38[0] = 1;
      v22 = sub_481810(a3, 2u);
      v23 = sub_481810(v22, 0);
      v36 = (unsigned __int8)sub_485060(v22) == 0;
      v24 = sub_485060(v23);
      if ( v36 )
      {
        do
        {
          if ( v24 == 0 )
            break;
          ++v38[0];
          v22 = sub_481810(v22, 2u);
          v23 = sub_481810(v23, 2u);
          v37 = (unsigned __int8)sub_485060(v22) == 0;
          v24 = sub_485060(v23);
        }
        while ( v37 );
      }
      if ( (v38[0] & 1) != 0 || (v10 & 1) == 0 || (v10 & 6) != 0 )
      {
        v12 = 20;
        goto LABEL_71;
      }
      v12 = v8 % 3 + 17;
    }
    if ( v12 != -1 )
      goto LABEL_70;
    goto LABEL_61;
  }
  if ( (v9 & 0xA0) == 0xA0 )
  {
    if ( (v9 & 0x11) == 0x11 )
    {
      v11 = (v8 & 1) + 23;
LABEL_69:
      v12 = v11;
LABEL_70:
      if ( v12 <= 0 )
        return true;
      goto LABEL_71;
    }
    v12 = (v9 & 1) != 0 ? 21 : 30;
  }
  else if ( (v9 & 0x82) == 0x82 )
  {
    if ( (v9 & 0x44) == 0x44 )
    {
      v11 = (v8 & 1) + 15;
      goto LABEL_69;
    }
    v12 = (v9 & 4) != 0 ? 14 : 22;
  }
  else if ( (v9 & 0xA) == 0xA )
  {
    if ( (v9 & 0x11) == 0x11 )
    {
      v11 = (v8 & 1) + 7;
      goto LABEL_69;
    }
    v12 = (v9 & 1) != 0 ? 13 : 6;
  }
  else
  {
    if ( (v9 & 0x28) != 0x28 )
      return true;
    if ( (v9 & 0x44) == 0x44 )
    {
      v11 = (v8 & 1) + 31;
      goto LABEL_69;
    }
    v12 = (v9 & 4) != 0 ? 5 : 29;
  }
LABEL_71:
  v25 = a3;
  dword_880990 = *((_DWORD *)dword_A8ED2C + v12 + dword_ABAD28 - 1);
  v26 = a3[9];
  v27 = word_ABDB64[2 * v12];
  v28 = word_ABDB66[2 * v12];
  LOWORD(a3) = v26 + v27;
  HIWORD(a3) = HIWORD(v26) + v28;
  v38[0] = a3;
  sub_4A91B0(v39, v38);
  LOBYTE(a3) = 1;
  if ( a4 == 1 )
  {
    sub_57B440(0, 0, *((_BYTE *)v25 + 283), a5, &a3, a6);
  }
  else
  {
    if ( a4 != 2 )
      return true;
    sub_57B440(dword_ABAD28, dword_ABAD28 + 41, *((_BYTE *)v25 + 283), a5, &a3, a6);
  }
  return (_BYTE)a3 != 0;
}
