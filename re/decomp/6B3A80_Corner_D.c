// 0x6b3a80 Corner_D size=24B

char __fastcall sub_6B3A80(int a1, char a2, int a3, int a4)
{
  int v4; // eax
  int v5; // ebp
  int v6; // edi
  int v7; // ecx
  int v8; // edi
  int v9; // ebp
  char *v10; // esi
  int v11; // ebx
  int v12; // eax
  int *v13; // edx
  int v14; // eax
  int v15; // eax
  int *v16; // edx
  char v18; // [esp+13h] [ebp-19h]
  int v19; // [esp+14h] [ebp-18h]
  int v20; // [esp+18h] [ebp-14h]
  int v22; // [esp+20h] [ebp-Ch]

  v4 = dword_8759A4;
  v5 = -1;
  v6 = -1;
  v7 = *((_DWORD *)dword_B0B6EC + 2 * a3 + 2 * a4 * dword_8759A4);
  v18 = a2;
  v19 = v7;
  v20 = -1;
  v22 = -1;
  while ( 1 )
  {
    if ( v6 != 0 || v5 != 0 )
    {
      v8 = a3 + v6;
      v9 = a4 + v5;
      if ( v8 >= 0 && v9 >= 0 && v8 < v4 && v9 < dword_8759A0 )
        break;
      if ( a2 == 0 )
        return 0;
    }
LABEL_39:
    v6 = ++v22;
    if ( v22 < 2 )
    {
      a2 = v18;
      v7 = v19;
      v5 = v20;
      v4 = dword_8759A4;
    }
    else
    {
      v5 = ++v20;
      if ( v20 >= 2 )
        return 1;
      a2 = v18;
      v7 = v19;
      v4 = dword_8759A4;
      v6 = -1;
      v22 = -1;
    }
  }
  v10 = (char *)dword_B0B6EC + 8 * v8 + 8 * v9 * v4;
  if ( v10[4] != 0 && (a2 == 0 || v10[6] == 0) )
  {
    if ( (int)abs32(*(_DWORD *)v10 - v7) > 15 )
      return 0;
    goto LABEL_39;
  }
  v11 = *(_DWORD *)v10;
  if ( (int)abs32(*(_DWORD *)v10 - v7) <= 15 )
    goto LABEL_39;
  if ( a1 == 1 )
  {
    if ( v11 < v7 )
    {
      if ( dword_B0B660 < dword_B0B658
        || (byte_B0B65D != 0 || dword_B0B658 == 0)
        && dword_B0B664 > 0
        && (*(unsigned __int8 (__thiscall **)(int *, int, _DWORD))(dword_B0B650 + 8))(
             &dword_B0B650,
             dword_B0B658 + dword_B0B664,
             0) != 0 )
      {
        v12 = dword_B0B660++;
        v13 = (int *)((char *)dword_B0B654 + 12 * v12);
        *v13 = v8;
        v13[1] = v9;
        v13[2] = v11;
      }
      v14 = v19 - 15;
      goto LABEL_33;
    }
  }
  else if ( v11 > v7 )
  {
    if ( dword_B0B660 < dword_B0B658
      || (byte_B0B65D != 0 || dword_B0B658 == 0)
      && dword_B0B664 > 0
      && (*(unsigned __int8 (__thiscall **)(int *, int, _DWORD))(dword_B0B650 + 8))(
           &dword_B0B650,
           dword_B0B664 + dword_B0B658,
           0) != 0 )
    {
      v15 = dword_B0B660++;
      v16 = (int *)((char *)dword_B0B654 + 12 * v15);
      *v16 = v8;
      v16[1] = v9;
      v16[2] = v11;
    }
    v14 = v19 + 15;
LABEL_33:
    *(_DWORD *)v10 = v14;
    v10[5] = 1;
  }
  if ( v10[4] != 0 || sub_6B3A80(a1, v18, v8, v9) != 0 || v18 != 0 )
    goto LABEL_39;
  return 0;
}
