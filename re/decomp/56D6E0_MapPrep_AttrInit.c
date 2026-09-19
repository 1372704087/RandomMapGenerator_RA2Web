// 0x56d6e0 MapPrep_AttrInit size=324

int __thiscall sub_56D6E0(_DWORD *this)
{
  _DWORD *v2; // edi
  int v3; // eax
  int result; // eax
  int v5; // ebp
  _DWORD *v6; // eax
  _DWORD *v7; // eax
  _DWORD *v8; // eax
  _DWORD *v9; // eax
  int v10; // ebx
  int v11; // ebx
  int v12; // eax
  int v13; // ecx
  int v14; // esi
  int v15; // ecx
  int v16; // eax
  int v17; // edx
  _DWORD *v18; // eax
  char v19; // al
  int v20; // ecx
  int v21; // eax
  _DWORD *i; // eax
  _DWORD *v23; // esi
  int v24; // edx
  int v25; // eax
  int v26; // ecx
  int v27; // eax
  int v28; // ecx
  int v29; // eax
  int v30; // esi
  int v31; // eax
  int v32; // ecx
  int v33; // ebp
  int v34; // ecx
  int v35; // eax
  int v36; // edx
  _DWORD *v37; // eax
  char v38; // [esp+Eh] [ebp-32h]
  char v39; // [esp+Fh] [ebp-31h]
  unsigned int v41; // [esp+14h] [ebp-2Ch]
  int v42; // [esp+18h] [ebp-28h] BYREF
  int v43; // [esp+1Ch] [ebp-24h]
  int v44; // [esp+28h] [ebp-18h]
  int v45; // [esp+38h] [ebp-8h]

  v2 = this + 20;
  (*(void (__thiscall **)(_DWORD *))(*(this + 20) + 12))(this + 20);
  v3 = *(this + 61);
  *(this + 67) = 1;
  *(this + 68) = v3;
  *(this + 69) = v3 - 1;
  *(this + 70) = (v3 << 11) + *(this + 79) + 4;
  result = sub_578290(this);
  v5 = result;
  if ( result != 0 )
  {
    while ( 1 )
    {
      if ( (unsigned __int8)sub_486750(v5) == 0 && (unsigned __int8)sub_486770(v5) == 0 )
      {
        if ( (unsigned __int8)sub_484AB0(v5) != 0 )
        {
          if ( (v6 = sub_481810((_DWORD *)v5, 2u), (unsigned __int8)sub_484AB0(v6) != 0)
            && (v7 = sub_481810((_DWORD *)v5, 6u), (unsigned __int8)sub_484AB0(v7) != 0)
            || (v8 = sub_481810((_DWORD *)v5, 4u), (unsigned __int8)sub_484AB0(v8) != 0)
            && (v9 = sub_481810((_DWORD *)v5, 0), (unsigned __int8)sub_484AB0(v9) != 0) )
          {
            v42 = *(_DWORD *)(sub_484F20(v5) + 40);
            v10 = sub_42B1C0(&v42);
            if ( sub_42B1C0(v5 + 36) < v10 )
            {
              v11 = *(_DWORD *)(sub_484F20(v5) + 40);
              v12 = v2[2];
              v13 = v2[4];
              v14 = *(_DWORD *)(v5 + 36);
              LOBYTE(v44) = 1;
              if ( v13 < v12
                || (*((_BYTE *)v2 + 13) != 0 || v12 == 0)
                && (v15 = v2[5]) > 0
                && (*(unsigned __int8 (__thiscall **)(_DWORD *, int, _DWORD))(*v2 + 8))(v2, v12 + v15, 0) != 0 )
              {
                v16 = v2[4];
                v17 = v44;
                v2[4] = v16 + 1;
                v18 = (_DWORD *)(v2[1] + 16 * v16);
                *v18 = v14;
                v18[1] = v11;
                v18[2] = v17;
                v18[3] = 1;
              }
            }
          }
        }
        goto LABEL_42;
      }
      v19 = sub_486750(v5);
      v20 = dword_AA0E28;
      if ( v19 == 0 )
        v20 = dword_ABAD1C;
      v21 = *(_DWORD *)(v5 + 56) - v20;
      if ( dword_82A734[v21] == *(unsigned __int8 *)(v5 + 282) )
        break;
LABEL_42:
      result = sub_578290(this);
      v5 = result;
      if ( result == 0 )
        return result;
    }
    v38 = 0;
    v41 = dword_82A774[v21];
    v39 = 1;
    for ( i = sub_481810((_DWORD *)v5, v41); ; i = sub_481810(v23, v41) )
    {
      while ( 1 )
      {
        v23 = i;
        v24 = *((__int16 *)i + 18);
        v25 = *((__int16 *)i + 19);
        v26 = *(this + 61);
        v43 = v25 + v24;
        if ( v25 + v24 <= v26 || v24 - v25 >= v26 || v25 - v24 >= v26 || v43 > v26 + 2 * *(this + 62) )
        {
          if ( v38 == 0 )
            goto LABEL_42;
LABEL_36:
          v30 = sub_481810(v23, ((_BYTE)v41 - 4) & 7)[9];
          v31 = v2[2];
          v32 = v2[4];
          v33 = *(_DWORD *)(v5 + 36);
          LOBYTE(v45) = v39;
          if ( v32 < v31
            || (*((_BYTE *)v2 + 13) != 0 || v31 == 0)
            && (v34 = v2[5]) > 0
            && (*(unsigned __int8 (__thiscall **)(_DWORD *, int, _DWORD))(*v2 + 8))(v2, v31 + v34, 0) != 0 )
          {
            v35 = v2[4];
            v36 = v45;
            v2[4] = v35 + 1;
            v37 = (_DWORD *)(v2[1] + 16 * v35);
            *v37 = v33;
            v37[1] = v30;
            v37[2] = v36;
            v37[3] = 0;
          }
          goto LABEL_42;
        }
        if ( v38 != 0 )
          goto LABEL_36;
        if ( (unsigned __int8)sub_486750(v23) == 0 )
          break;
        v27 = v23[14];
        v28 = dword_AA0E28;
LABEL_27:
        v29 = v27 - v28;
        if ( v29 != -1 && dword_82A7B4[v29] == *((unsigned __int8 *)v23 + 282) )
          v38 = 1;
LABEL_30:
        i = sub_481810(v23, v41);
      }
      if ( (unsigned __int8)sub_486770(v23) != 0 )
      {
        v27 = v23[14];
        v28 = dword_ABAD1C;
        goto LABEL_27;
      }
      if ( (v23[80] & 0x100) != 0 )
        goto LABEL_30;
      v39 = 0;
    }
  }
  return result;
}
